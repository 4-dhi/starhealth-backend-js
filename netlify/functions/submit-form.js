const nodemailer = require("nodemailer");
const validator = require("validator");

// Enhanced logging function
const log = (message, data = null) => {
  console.log(
    `[${new Date().toISOString()}] ${message}`,
    data ? JSON.stringify(data, null, 2) : ""
  );
};

// Email configuration with better error handling
const createTransporter = () => {
  const config = {
    service: "gmail",
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
    },
  };

  log("Creating transporter with config:", {
    service: config.service,
    user: config.auth.user ? "SET" : "NOT SET",
    pass: config.auth.pass ? "SET" : "NOT SET",
  });

  return nodemailer.createTransporter(config);
};

// Validation function
const validateFormData = (data) => {
  const errors = [];

  if (!data.name || data.name.trim().length < 2) {
    errors.push("Name is required and must be at least 2 characters");
  }

  if (!data.email || !validator.isEmail(data.email)) {
    errors.push("Valid email is required");
  }

  if (
    !data.phone ||
    !validator.isMobilePhone(data.phone, "any", { strictMode: false })
  ) {
    errors.push("Valid phone number is required");
  }

  return errors;
};

// Build email subject with timestamp
const buildEmailSubject = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  const timestamp = `${day}${month}${year}${hours}${minutes}`;
  return `New Form Submission - Insurance Quote Request #${timestamp}`;
};

// Build email body
const buildEmailBody = (formData) => {
  return `
New Form Submission Received

Details:
Name: ${formData.name}
Email: ${formData.email}
Phone: ${formData.phone}
Insurance Needs: ${formData.needs || "Not specified"}

Please follow up with the customer as needed.
  `.trim();
};

// Main handler function
exports.handler = async (event, context) => {
  log("Function invoked", {
    httpMethod: event.httpMethod,
    headers: event.headers,
    hasBody: !!event.body,
  });

  // Handle CORS preflight requests
  if (event.httpMethod === "OPTIONS") {
    log("Handling OPTIONS request");
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: "",
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    log("Method not allowed:", event.httpMethod);
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "error",
        message: "Method not allowed",
      }),
    };
  }

  try {
    // Check environment variables
    if (!process.env.MAIL_USERNAME || !process.env.MAIL_PASSWORD) {
      log("Missing environment variables");
      throw new Error("Missing required environment variables");
    }

    // Parse form data
    let formData;

    // Handle both JSON and form-encoded data
    if (event.headers["content-type"]?.includes("application/json")) {
      log("Parsing JSON data");
      formData = JSON.parse(event.body);
    } else {
      log("Parsing form data");
      // Parse form-encoded data
      const params = new URLSearchParams(event.body);
      formData = {
        name: params.get("name"),
        email: params.get("email"),
        phone: params.get("phone"),
        needs: params.get("needs"),
      };
    }

    log("Form data received:", formData);

    // Validate form data
    const validationErrors = validateFormData(formData);
    if (validationErrors.length > 0) {
      log("Validation errors:", validationErrors);
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "error",
          message: "Validation errors",
          errors: validationErrors,
        }),
      };
    }

    // Create email transporter
    const transporter = createTransporter();

    // Email options
    const mailOptions = {
      from: process.env.MAIL_USERNAME,
      to: process.env.EMAIL_TO || "default@example.com",
      subject: buildEmailSubject(),
      text: buildEmailBody(formData),
    };

    log("Sending email with options:", {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    });

    // Send email
    const result = await transporter.sendMail(mailOptions);
    log("Email sent successfully:", { messageId: result.messageId });

    // Success response
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "success",
        message: "Form submitted successfully!",
      }),
    };
  } catch (error) {
    log("Error processing form:", {
      message: error.message,
      stack: error.stack,
    });

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "error",
        message: "Internal server error. Please try again.",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      }),
    };
  }
};
