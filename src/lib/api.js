export const API = async (method, name, d = {}, isFile = false) => {
  if (method == "GET" || method == "DELETE") {
    const data = await fetch("/api/" + name, {
      method: method,
    });
    return await data.json();
  }

  if (isFile && d instanceof FormData) {
    const data = await fetch("/api/" + name, {
      method,
      body: d,
    });
    return await data.json();
  }

  const data = await fetch("/api/" + name, {
    method: method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(d),
  });
  return await data.json();
};

export const isAllowed = (required = [], session) => {
  if (!session || !Array.isArray(required) || required.length === 0) return false;
  const permissions = Array.isArray(session.permissions) ? session.permissions : [];
  const roles = Array.isArray(session.roles) ? session.roles : [];
  for (const item of required) {
    if (permissions.includes(item) || roles.includes(item)) return true;
  }
  return false;
};

export const invoiceTypesOptions = [
  { value: "", label: "Select Invoice Type" },
];
