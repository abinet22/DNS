const macaddress = require('macaddress');

// Function to fetch MAC address
const getMacAddress = () => {
  return new Promise((resolve, reject) => {
    macaddress.one((err, mac) => {
      if (err) {
        reject(err); // Reject the Promise if there's an error
      } else {
        resolve(mac); // Resolve the Promise with the MAC address
      }
    });
  });
};

// Middleware to retrieve MAC address and attach it to req object
const macAddressMiddleware = async (req, res, next) => {
  try {
    const mac = await getMacAddress(); // Wait for the MAC address
    req.macAddress = mac; // Attach the MAC address to the request object
    next(); // Call the next middleware or route handler
  } catch (err) {
    console.error("Error fetching MAC address:", err);
    req.macAddress = null; // Set MAC address to null in case of error
    next(); // Continue to next middleware/route handler even if there's an error
  }
};

module.exports = macAddressMiddleware;
