const { BlobServiceClient, StorageSharedKeyCredential } = require("@azure/storage-blob");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config({ path: ".env.local" });

const testAzureConnection = async () => {
  console.log("🔍 Testing Azure Blob Storage Connection...\n");

  // Check environment variables
  console.log("📋 Environment Variables:");
  console.log("AZURE_STORAGE_ACCOUNT_NAME:", process.env.AZURE_STORAGE_ACCOUNT_NAME ? "✅ Set" : "❌ Missing");
  console.log("AZURE_STORAGE_ACCOUNT_KEY:", process.env.AZURE_STORAGE_ACCOUNT_KEY ? "✅ Set" : "❌ Missing");
  console.log("AZURE_STORAGE_CONTAINER_NAME:", process.env.AZURE_STORAGE_CONTAINER_NAME ? "✅ Set" : "❌ Missing");
  console.log("");

  if (!process.env.AZURE_STORAGE_ACCOUNT_NAME || !process.env.AZURE_STORAGE_ACCOUNT_KEY) {
    console.log("❌ Missing required Azure credentials in environment variables");
    return;
  }

  try {
    // Test 1: Create BlobServiceClient
    console.log("1️⃣ Testing BlobServiceClient creation...");
    const sharedKeyCredential = new StorageSharedKeyCredential(process.env.AZURE_STORAGE_ACCOUNT_NAME, process.env.AZURE_STORAGE_ACCOUNT_KEY);
    const blobServiceClient = new BlobServiceClient(`https://${process.env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`, sharedKeyCredential);
    console.log("✅ BlobServiceClient created successfully");

    // Test 2: List containers
    console.log("2️⃣ Testing account access - listing containers...");
    const containerIter = blobServiceClient.listContainers();
    const containers = [];
    for await (const container of containerIter) {
      containers.push(container.name);
    }
    console.log("✅ Account access successful");
    console.log("📁 Available containers:", containers);

    // Test 3: Check if target container exists
    const targetContainer = process.env.AZURE_STORAGE_CONTAINER_NAME;
    console.log(`3️⃣ Checking if container '${targetContainer}' exists...`);

    const containerClient = blobServiceClient.getContainerClient(targetContainer);
    const containerExists = await containerClient.exists();

    if (containerExists) {
      console.log(`✅ Container '${targetContainer}' exists`);
    } else {
      console.log(`❌ Container '${targetContainer}' does not exist`);
      console.log("💡 Creating container...");
      await containerClient.create();
      console.log(`✅ Container '${targetContainer}' created successfully`);
    }

    // Test 4: Test file upload
    console.log("4️⃣ Testing file upload...");
    const testFileName = `test/test-${Date.now()}.txt`;
    const testContent = "Hello Azure Blob Storage!";
    const testBuffer = Buffer.from(testContent, "utf-8");

    const blockBlobClient = containerClient.getBlockBlobClient(testFileName);
    await blockBlobClient.upload(testBuffer, testBuffer.length);
    console.log(`✅ Test file uploaded successfully: ${testFileName}`);

    // Test 5: Test file download
    console.log("5️⃣ Testing file download...");
    const downloadResponse = await blockBlobClient.download();
    const downloadedContent = await streamToString(downloadResponse.readableStreamBody);
    console.log(`✅ Test file downloaded successfully. Content: "${downloadedContent}"`);

    // Test 6: Test file deletion
    console.log("6️⃣ Testing file deletion...");
    await blockBlobClient.delete();
    console.log("✅ Test file deleted successfully");

    console.log("\n🎉 All tests passed! Azure Blob Storage connection is working correctly.");
  } catch (error) {
    console.error("❌ Azure Blob Storage test failed:");
    console.error("Error name:", error.name);
    console.error("Error code:", error.code);
    console.error("Status code:", error.statusCode);
    console.error("Message:", error.message);

    if (error.details) {
      console.error("Details:", error.details);
    }

    // Specific error handling
    if (error.code === "NoAuthenticationInformation") {
      console.log("\n🔧 Troubleshooting suggestions:");
      console.log("1. Verify your Azure Storage Account Name is correct");
      console.log("2. Verify your Azure Storage Account Key is correct and not expired");
      console.log("3. Check if the storage account exists in your Azure subscription");
      console.log("4. Ensure the storage account key has proper permissions");
    }
  }
};

// Helper function to convert stream to string
async function streamToString(readableStream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on("data", data => {
      chunks.push(data.toString());
    });
    readableStream.on("end", () => {
      resolve(chunks.join(""));
    });
    readableStream.on("error", reject);
  });
}

// Run the test
testAzureConnection();
