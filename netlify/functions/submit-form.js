const nodemailer = require("nodemailer");
const validator = require("validator");

// Email configuration
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
    },
  });
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
  // Handle CORS preflight requests
  if (event.httpMethod === "OPTIONS") {
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
    // Parse form data
    let formData;

    // Handle both JSON and form-encoded data
    if (event.headers["content-type"]?.includes("application/json")) {
      formData = JSON.parse(event.body);
    } else {
      // Parse form-encoded data
      const params = new URLSearchParams(event.body);
      formData = {
        name: params.get("name"),
        email: params.get("email"),
        phone: params.get("phone"),
        needs: params.get("needs"),
      };
    }

    // Validate form data
    const validationErrors = validateFormData(formData);
    if (validationErrors.length > 0) {
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
      to: process.env.EMAIL_TO || "abcd@gmail.com",
      subject: buildEmailSubject(),
      text: buildEmailBody(formData),
    };

    // Send email
    await transporter.sendMail(mailOptions);

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
    console.error("Error processing form:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: "error",
        message: "Internal server error. Please try again.",
      }),
    };
  }
};
