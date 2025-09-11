import { prisma } from "@/lib/useful";
import { putFile } from "@/lib/blob.mjs";

// Payment processing functions for vehicle API
export const processPayments = async (vehicleId, paymentsData, paymentFiles) => {
  let paymentsProcessed = 0;
  const paymentErrors = [];

  if (!paymentsData || paymentsData.length === 0) {
    return { paymentsProcessed: 0, paymentErrors: [] };
  }

  try {
    // Process each payment
    for (let i = 0; i < paymentsData.length; i++) {
      const payment = paymentsData[i];
      
      try {
        let fileUrl = null;
        
        // Handle file upload if present
        if (payment.hasFile && paymentFiles[`paymentFile_${i}`]) {
          const file = paymentFiles[`paymentFile_${i}`][0];
          const uploadResult = await putFile(file, "payments/");
          fileUrl = uploadResult.url;
          console.log(`✅ Successfully uploaded payment document: ${uploadResult.fileName}`);
        }

        // Create payment record
        await prisma.vehiclePayments.create({
          data: {
            vehicleId: vehicleId,
            name: payment.name,
            date: new Date(payment.date),
            remarks: payment.remarks,
            url: fileUrl,
          },
        });

        paymentsProcessed++;
      } catch (paymentError) {
        console.error(`❌ Failed to process payment ${i}:`, paymentError);
        paymentErrors.push({
          paymentIndex: i,
          paymentName: payment.name,
          error: paymentError.message
        });
      }
    }
  } catch (error) {
    console.error("❌ Payment processing failed:", error);
    paymentErrors.push({
      error: error.message,
      context: "Payment processing"
    });
  }

  return { paymentsProcessed, paymentErrors };
};

export const processPaymentOperations = async (vehicleId, paymentOperations, paymentFiles) => {
  let paymentsProcessed = 0;
  let paymentsDeleted = 0;
  const paymentErrors = [];

  if (!paymentOperations) {
    return { paymentsProcessed: 0, paymentsDeleted: 0, paymentErrors: [] };
  }

  try {
    // Delete payments
    if (paymentOperations.toDelete && paymentOperations.toDelete.length > 0) {
      const deleteResult = await prisma.vehiclePayments.deleteMany({
        where: {
          id: { in: paymentOperations.toDelete },
          vehicleId: vehicleId // Ensure payments belong to this vehicle
        }
      });
      paymentsDeleted = deleteResult.count;
    }

    // Update existing payments
    if (paymentOperations.toUpdate && paymentOperations.toUpdate.length > 0) {
      for (const payment of paymentOperations.toUpdate) {
        try {
          let fileUrl = payment.url; // Keep existing URL by default
          
          // Handle file upload if present
          if (payment.hasFile && payment.fileIndex !== null && paymentFiles[`paymentFile_${payment.fileIndex}`]) {
            const file = paymentFiles[`paymentFile_${payment.fileIndex}`][0];
            const uploadResult = await putFile(file, "payments/");
            fileUrl = uploadResult.url;
            console.log(`✅ Successfully uploaded payment document: ${uploadResult.fileName}`);
          }

          await prisma.vehiclePayments.update({
            where: { id: payment.id },
            data: {
              name: payment.name,
              date: new Date(payment.date),
              remarks: payment.remarks,
              url: fileUrl,
            },
          });

          paymentsProcessed++;
        } catch (paymentError) {
          console.error(`❌ Failed to update payment ${payment.id}:`, paymentError);
          paymentErrors.push({
            paymentId: payment.id,
            paymentName: payment.name,
            error: paymentError.message
          });
        }
      }
    }

    // Create new payments
    if (paymentOperations.toCreate && paymentOperations.toCreate.length > 0) {
      for (const payment of paymentOperations.toCreate) {
        try {
          let fileUrl = null;
          
          // Handle file upload if present
          if (payment.hasFile && payment.fileIndex !== null && paymentFiles[`paymentFile_${payment.fileIndex}`]) {
            const file = paymentFiles[`paymentFile_${payment.fileIndex}`][0];
            const uploadResult = await putFile(file, "payments/");
            fileUrl = uploadResult.url;
            console.log(`✅ Successfully uploaded payment document: ${uploadResult.fileName}`);
          }

          await prisma.vehiclePayments.create({
            data: {
              vehicleId: vehicleId,
              name: payment.name,
              date: new Date(payment.date),
              remarks: payment.remarks,
              url: fileUrl,
            },
          });

          paymentsProcessed++;
        } catch (paymentError) {
          console.error(`❌ Failed to create payment:`, paymentError);
          paymentErrors.push({
            paymentName: payment.name,
            error: paymentError.message
          });
        }
      }
    }
  } catch (error) {
    console.error("❌ Payment operations failed:", error);
    paymentErrors.push({
      error: error.message,
      context: "Payment operations"
    });
  }

  return { paymentsProcessed, paymentsDeleted, paymentErrors };
};


