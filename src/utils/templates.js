const moment = require('moment');

const header = (data) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Product Booking Notification</title>
        </head>
        <body style="margin:0; padding:0; background-color:#fffffd; font-family:Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9f9f9; padding:30px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 3px 6px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td align="center" style="background:linear-gradient(90deg,#ffddcc,#f2f2f2,#ffddcc); padding:25px;">
                      <img src="https://www.astroguid.com/assets/astroguid%20logo%20text-CbLllUYK.png" alt="Astroguid Logo" style="max-height:50px; display:block;" />
                    </td>
                  </tr>
                   <!-- Title -->
                    <tr>
                      <td align="center" style="background:linear-gradient(90deg,#ff4e50,#f2703f); padding: 10px 20px 10px;">
                        <h2 style="margin:0; color:#ffffff;">${data.title}</h2>
                        <p style="margin:8px 0 0; color:#fff;">${data.subTitle}</p>
                      </td>
                    </tr>

  `;

const footer = `
<tr>
<td align="center">
                        <p style="margin-top:25px; color:#555;">
                          For any support or queries, please contact us at 
                          <strong>+91 XXXXXXXXXX</strong>
                        </p>
                      </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                      <td align="center" style="background:linear-gradient(90deg,#f2703f,#ff4e50); color:#fff; padding:15px; font-size:13px;">
                        © 2025 Astroguid. All rights reserved.
                      </td>
                    </tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>`

const statusColors = {
  PENDING: "#ff9800",
  CONFIRMED: "#4caf50",
  SHIPPED: "#2196f3",
  DELIVERED: "#2e7d32",
  CANCELLED: "#f44336",
  REFUNDED: "#6c757d",
  FAILED: "#f44336",
  PAID: "#4caf50",
  PENDING: "#ff9800",
  REFUND: "#6c757d",
};

// Test Route

async function generateTemplates(notificationFor, data) {
  try {
    switch (notificationFor) {
      // 🟠 Product Status Update
      case "PRODUCT_STATUS_UPDATE": {

        const currentStatus = data?.orderStatus || "PENDING";
        const color = statusColors[currentStatus] || "#f2703f";
        const paymentStatus = data?.paymentStatus || "PENDING";
        const paymentColor = statusColors[paymentStatus] || "#f2703f";

        const messageMap = {
          PENDING: "Your order has been received and is awaiting confirmation.",
          CONFIRMED: "Your order has been confirmed and is being prepared.",
          SHIPPED: "Your order has been shipped and is on its way!",
          DELIVERED: "Your order has been successfully delivered. Thank you for shopping with us!",
          CANCELLED: "Your order has been cancelled. Please contact support for details.",
          REFUNDED: "Your order has been refunded. Please check your payment method for updates.",
        };

        const message = messageMap[currentStatus] || "Your order status has been updated.";

        // Product Table
        const productRows = (data.items || [])
          .map((item, i) => {
            const product = data.productData?.find(
              (p) => p._id.toString() === item.product.toString()
            );
            return `
              <tr style="border-bottom:1px solid #f3f3f3;">
                <td style="padding:10px; text-align:center; color:#333;">${i + 1}</td>
                <td style="padding:10px; color:#333;">${product?.name || "N/A"}</td>
                <td style="padding:10px; text-align:center; color:#333;">${item.quantity || 1}</td>
                <td style="padding:10px; text-align:right; color:#333;">₹${(item.subtotal)?.toFixed(2) || "0.00"}</td>
              </tr>
            `;
          })
          .join("");

        const totalAmount = data.finalAmount || 0;

        // 🧑‍💼 USER EMAIL
        const userBody = `
                    <!-- Body -->
                    <tr>
                      <td style="padding:0px 40px; color:#333; font-size:15px; line-height:22px;">
                        <p>Hi <strong>${data?.customerData?.firstName || "Customer"}</strong>,</p>
                        <p>${message}</p>

                        <p style="margin:15px 0;">
                          <strong>Booking ID:</strong> ${data?._id || "N/A"}<br/>
                          <strong>Date:</strong> ${data?.createdAt
            ? new Date(data.createdAt).toLocaleString("en-IN")
            : "[dd-mm-yyyy hh:mm]"}<br/>
                          <strong>Payment Status:</strong> <span style="color:${paymentColor}; font-weight:bold;">${paymentStatus}</span><br/>
                          <strong>Current Status:</strong> <span style="color:${color}; font-weight:bold;">${currentStatus}</span>
                        </p>

                        <!-- Product Table -->
                        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse; margin-top:15px; border:1px solid #f3f3f3;">
                          <thead>
                            <tr style="background:linear-gradient(90deg,#f2703f,#ff4e50); color:#fff;">
                              <th style="padding:10px;">#</th>
                              <th style="padding:10px; text-align:left;">Product</th>
                              <th style="padding:10px;">Qty</th>
                              <th style="padding:10px; text-align:right;">Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${productRows ||
          `<tr><td colspan="4" style="padding:10px; text-align:center; color:#777;">No products found</td></tr>`}
                            <tr>
                              <td colspan="3" style="padding:10px; text-align:right; font-weight:bold; color:#333;">Total</td>
                              <td style="padding:10px; text-align:right; font-weight:bold; color:#333;">₹${totalAmount?.toFixed(2) || "0.00"}</td>
                            </tr>
                          </tbody>
                        </table>
        `;

        // 🧾 ADMIN EMAIL
        const adminBody = `
                    <!-- Body -->
                    <tr>
                      <td style="padding:25px 40px; color:#333; font-size:15px; line-height:22px;">
                        <p>Hello Admin,</p>
                        <p>The order from <strong>${data?.customerData?.firstName || "Customer"}</strong> has been updated to <strong style="color:${color};">${currentStatus}</strong>.</p>

                        <p style="margin:15px 0;">
                          <strong>Booking ID:</strong> ${data?._id || "N/A"}<br/>
                          <strong>Date:</strong> ${data?.createdAt
            ? new Date(data.createdAt).toLocaleString("en-IN")
            : "[dd-mm-yyyy hh:mm]"}<br/>
                          <strong>Payment Status:</strong> <span style="color:${paymentColor}; font-weight:bold;">${paymentStatus}</span><br/>
                          <strong>Current Status:</strong> <span style="color:${color}; font-weight:bold;">${currentStatus}</span>
                        </p>

                        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse; margin-top:15px; border:1px solid #f3f3f3;">
                          <thead>
                            <tr style="background:linear-gradient(90deg,#f2703f,#ff4e50); color:#fff;">
                              <th style="padding:10px;">#</th>
                              <th style="padding:10px; text-align:left;">Product</th>
                              <th style="padding:10px;">Qty</th>
                              <th style="padding:10px; text-align:right;">Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${productRows ||
          `<tr><td colspan="4" style="padding:10px; text-align:center; color:#777;">No products found</td></tr>`}
                            <tr>
                              <td colspan="3" style="padding:10px; text-align:right; font-weight:bold; color:#333;">Total</td>
                              <td style="padding:10px; text-align:right; font-weight:bold; color:#333;">₹${totalAmount?.toFixed(2) || "0.00"}</td>
                            </tr>
                          </tbody>
                        </table>
        `;

        return {
          userBody: `${header({ title: 'Product Order Status Update', subTitle: 'Here’s your latest order update' })}${userBody}${footer}`,
          adminBody: `${header({ title: 'Product Order Status Update', subTitle: 'Here’s the latest order update' })}${adminBody}${footer}`,
        };
      }

      case "PRODUCT_BOOKING": {

        const currentStatus = data?.orderStatus || "PENDING";
        const paymentStatus = data?.paymentStatus || "PENDING";
        const color = statusColors[currentStatus] || "#f2703f";
        const paymentColor = statusColors[paymentStatus] || "#f2703f";

        const message = "Your product booking has been successfully placed. Here are your order details:";

        // Product Table
        const productRows = (data.items || [])
          .map((item, i) => {
            const product = data.productData?.find(
              (p) => p._id.toString() === item.product.toString()
            );
            return `
              <tr style="border-bottom:1px solid #f3f3f3;">
                <td style="padding:10px; text-align:center; color:#333;">${i + 1}</td>
                <td style="padding:10px; color:#333;">${product?.name || "N/A"}</td>
                <td style="padding:10px; text-align:center; color:#333;">${item.quantity || 1}</td>
                <td style="padding:10px; text-align:right; color:#333;">₹${(item.subtotal)?.toFixed(2) || "0.00"}</td>
              </tr>
            `;
          })
          .join("");

        const totalAmount = data.finalAmount || 0;

        // 🧑‍💼 USER EMAIL
        const userBody = `
                    <!-- Body -->
                    <tr>
                      <td style="padding:10px 20px; color:#333; font-size:15px; line-height:22px;">
                        <p>Hi <strong>${data?.customerData?.firstName || "Customer"}</strong>,</p>
                        <p>${message}</p>

                        <p style="margin:15px 0;">
                          <strong>Booking ID:</strong> ${data?._id || "N/A"}<br/>
                          <strong>Date:</strong> ${data?.createdAt
            ? new Date(data.createdAt).toLocaleString("en-IN")
            : "[dd-mm-yyyy hh:mm]"}<br/>
                          <strong>Payment Status:</strong><span style="color:${paymentColor}; font-weight:bold;"> ${data?.paymentStatus || "Pending"}</span> <br/>
                          <strong>Current Status:</strong> <span style="color:${color}; font-weight:bold;">${currentStatus}</span>
                        </p>

                        <!-- Product Table -->
                        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse; margin-top:15px; border:1px solid #f3f3f3;">
                          <thead>
                            <tr style="background:linear-gradient(90deg,#f2703f,#ff4e50); color:#fff;">
                              <th style="padding:10px;">#</th>
                              <th style="padding:10px; text-align:left;">Product</th>
                              <th style="padding:10px;">Qty</th>
                              <th style="padding:10px; text-align:right;">Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${productRows ||
          `<tr><td colspan="4" style="padding:10px; text-align:center; color:#777;">No products found</td></tr>`}
                            <tr>
                              <td colspan="3" style="padding:10px; text-align:right; font-weight:bold; color:#333;">Total</td>
                              <td style="padding:10px; text-align:right; font-weight:bold; color:#333;">₹${totalAmount?.toFixed(2) || "0.00"}</td>
                            </tr>
                          </tbody>
                        </table>
        `;

        // 🧾 ADMIN EMAIL
        const adminBody = `
                    <!-- Body -->
                    <tr>
                      <td style="padding:10px 20px; color:#333; font-size:15px; line-height:22px;">
                        <p>Hello Admin,</p>
                        <p>The order from <strong>${data?.customerData?.firstName || "Customer"}</strong> has been recieved.</p>

                        <p style="margin:15px 0;">
                          <strong>Booking ID:</strong> ${data?._id || "N/A"}<br/>
                          <strong>Date:</strong> ${data?.createdAt
            ? new Date(data.createdAt).toLocaleString("en-IN")
            : "[dd-mm-yyyy hh:mm]"}<br/>
                          <strong>Payment Status:</strong><span style="color:${paymentColor}; font-weight:bold;">${data?.paymentStatus || "Pending"}</span> <br/>
                          <strong>Current Status:</strong> <span style="color:${color}; font-weight:bold;">${currentStatus}</span>
                        </p>

                        <table width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse; margin-top:15px; border:1px solid #f3f3f3;">
                          <thead>
                            <tr style="background:linear-gradient(90deg,#f2703f,#ff4e50); color:#fff;">
                              <th style="padding:10px;">#</th>
                              <th style="padding:10px; text-align:left;">Product</th>
                              <th style="padding:10px;">Qty</th>
                              <th style="padding:10px; text-align:right;">Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${productRows ||
          `<tr><td colspan="4" style="padding:10px; text-align:center; color:#777;">No products found</td></tr>`}
                            <tr>
                              <td colspan="3" style="padding:10px; text-align:right; font-weight:bold; color:#333;">Total</td>
                              <td style="padding:10px; text-align:right; font-weight:bold; color:#333;">₹${totalAmount?.toFixed(2) || "0.00"}</td>
                            </tr>
                          </tbody>
                        </table>
        `;

        return {
          userBody: `${header({ title: 'Product Order Recieved', subTitle: 'Here’s your latest order update' })}${userBody}${footer}`,
          adminBody: `${header({ title: 'Product Order Recieved', subTitle: 'Here’s the latest order update' })}${adminBody}${footer}`,
        };
      }

      case "UPCOMING_BOOKINGS": {
        const start = data?.startTime ? new Date(data.startTime) : null;
        const dateStr = `${moment(data?.bookingDate).format("DD-MM-YYYY")}`;
        const minutes = `${data?.serviceData[0]?.durationInMinutes} minutes, ${data?.startTime}-${data?.endTime}` || "[minutes]";
        const place = data?.place || data?.mode || "Online";
        const serviceName = data?.serviceData[0]?.name || data?.service?.name || "Service";
        const astrologer = data?.astrologerProfile?.firstName ? `${data?.astrologerProfile?.firstName} ${data?.astrologerProfile?.lastName}` : "Please Check Dashboard";
        const meetingUrl = data?.meetingUrl || data?.zoomJoinUrl || "";
        const appointmentNote = data?.appointmentNote || data?.note || "";
        const astrologerStatus = data?.astrologerStatus || "PENDING";

        const meetingButton = meetingUrl
          ? `<p style="margin:14px 0 0;"><a href="${meetingUrl}" target="_blank" style="background:#f2703f; color:#fff; padding:10px 16px; text-decoration:none; border-radius:6px; display:inline-block;">Join Online Meeting</a></p>`
          : "";

        const body = `
          <tr>
            <td style="padding:14px 20px; color:#333; font-size:15px; line-height:22px;">
              <p>Hi <strong>${data?.customerData?.firstName || "Customer"}</strong>,</p>
              <p>This is a reminder for your upcoming Astrology consultancy session. Please find the booking details below:</p>

              <p style="margin:15px 0;">
                <strong>Booking ID:</strong> ${data?._id || "XXXXX"}<br/>
                <strong>Date:</strong> ${dateStr} for ${minutes}<br/>
                <strong>Place:</strong> ${place}<br/>
                <strong>Name of Service:</strong> ${serviceName}<br/>
                <strong>Astrologer:</strong> ${astrologer || "To be assigned"}<br/>
                <strong>Astrologer Status:</strong> <span style="color:${statusColors[astrologerStatus]}">${astrologerStatus}</span><br/>
                ${meetingButton}
              </p>

              ${appointmentNote ? `<p style="margin:15px 0;"><strong>Special Instructions:</strong> ${appointmentNote}</p>` : ""}

              <p style="margin:18px 0;">
                For Online booking please join the Zoom link at least 10 mins before start time so that you resolve tech or device issues if any. Ensure that you are connected to Internet.
              </p>
              <p style="margin:10px 0;">
                For Offline Pooja at your home, make sure that all arrangements are done as per the appointment note.
              </p>
            </td>
          </tr>
        `;

        const abody = `
          <tr>
            <td style="padding:14px 20px; color:#333; font-size:15px; line-height:22px;">
              <p>Hi <strong>${astrologer || "Astrologer"}</strong>,</p>
              <p>This is a reminder for your upcoming Astrology consultancy session with ${data?.customerData?.firstName ? `${data?.customerData?.firstName} ${data?.customerData?.lastName}` : "Customer"}. Please find the booking details below:</p>

              <p style="margin:15px 0;">
                <strong>Booking ID:</strong> ${data?._id || "XXXXX"}<br/>
                <strong>Date:</strong> ${dateStr} for ${minutes}<br/>
                <strong>Place:</strong> ${place}<br/>
                <strong>Name of Service:</strong> ${serviceName}<br/>
                <strong>Astrologer:</strong> ${astrologer || "To be assigned"}<br/>
                <strong>Astrologer Status:</strong> <span style="color:${statusColors[astrologerStatus]}">${astrologerStatus}</span><br/>
                ${meetingButton}
              </p>

              ${appointmentNote ? `<p style="margin:15px 0;"><strong>Special Instructions:</strong> ${appointmentNote}</p>` : ""}

              <p style="margin:18px 0;">
                For Online booking please join the Zoom link at least 10 mins before start time so that you resolve tech or device issues if any. Ensure that you are connected to Internet.
              </p>
              <p style="margin:10px 0;">
                For Offline Pooja at your home, make sure that all arrangements are done as per the appointment note.
              </p>
            </td>
          </tr>
        `;

        const userBody = body;
        const adminBody = abody;

        return {
          userBody: `${header({ title: 'Upcoming Astrology Consultation – Reminder', subTitle: '' })}${userBody}${footer}`,
          adminBody: `${header({ title: 'Upcoming Consultation – Reminder', subTitle: '' })}${adminBody}${footer}`,
        };
      }

      case "SERVICE_BOOKING": {
        const start = data?.startTime ? new Date(data.startTime) : null;
        const dateStr = `${moment(data?.bookingDate).format("DD-MM-YYYY")}`;
        const minutes = `${data?.serviceData[0]?.durationInMinutes} minutes, ${data?.startTime}-${data?.endTime}` || "[minutes]";
        const place = data?.place || data?.mode || "Online";
        const serviceName = data?.serviceData[0]?.name || data?.service?.name || "Service";
        const astrologer = data?.astrologerProfile?.firstName ? `${data?.astrologerProfile?.firstName} ${data?.astrologerProfile?.lastName}` : "Please Check Dashboard";
        const meetingUrl = data?.meetingUrl || data?.zoomJoinUrl || "";
        const appointmentNote = data?.appointmentNote || data?.note || "";
        const astrologerStatus = data?.astrologerStatus || "PENDING";

        const meetingButton = meetingUrl
          ? `<p style="margin:14px 0 0;"><a href="${meetingUrl}" target="_blank" style="background:#f2703f; color:#fff; padding:10px 16px; text-decoration:none; border-radius:6px; display:inline-block;">Join Online Meeting</a></p>`
          : "";

        const body = `
          <tr>
            <td style="padding:14px 20px; color:#333; font-size:15px; line-height:22px;">
              <p>Hi <strong>${data?.customerData?.firstName || "Customer"}</strong>,</p>
              <p>Your Astrology consultancy session bas been booked successfully. Below are the details of the booking :</p>

              <p style="margin:15px 0;">
                <strong>Booking ID:</strong> ${data?._id || "XXXXX"}<br/>
                <strong>Date:</strong> ${dateStr} for ${minutes}<br/>
                <strong>Place:</strong> ${place}<br/>
                <strong>Name of Service:</strong> ${serviceName}<br/>
                <strong>Astrologer:</strong> ${astrologer || "To be assigned"}<br/>
                <strong>Astrologer Status:</strong> <span style="color:${statusColors[astrologerStatus]}">${astrologerStatus}</span><br/>
                ${meetingButton}
              </p>

              ${appointmentNote ? `<p style="margin:15px 0;"><strong>Special Instructions:</strong> ${appointmentNote}</p>` : ""}

              <p style="margin:18px 0;">
                For Online booking please join the Zoom link at least 10 mins before start time so that you resolve tech or device issues if any. Ensure that you are connected to Internet.
              </p>
              <p style="margin:10px 0;">
                For Offline Pooja at your home, make sure that all arrangements are done as per the appointment note.
              </p>
            </td>
          </tr>
        `;

        const abody = `
          <tr>
            <td style="padding:14px 20px; color:#333; font-size:15px; line-height:22px;">
              <p>Hi <strong>${astrologer || "Astrologer"}</strong>,</p>
              <p>
                ${data?.customerData?.firstName || "Customer"} has booked a slot with you.
                Please check the booking details on your dashboard and update the booking status accordingly.
              </p>
              <p><strong>Booking Details:</strong></p>

              <p style="margin:15px 0;">
                <strong>Booking ID:</strong> ${data?._id || "XXXXX"}<br/>
                <strong>Date:</strong> ${dateStr} for ${minutes}<br/>
                <strong>Place:</strong> ${place}<br/>
                <strong>Name of Service:</strong> ${serviceName}<br/>
                <strong>Customer:</strong> ${data?.customerData?.firstName || "Please check Dashboard"}<br/>
                <strong>Your Status:</strong> <span style="color:${statusColors[astrologerStatus]}">${astrologerStatus}</span><br/>
                ${meetingButton}
              </p>

              <p style="margin:18px 0;">
                For Online booking please join the Zoom link at least 10 mins before start time so that you resolve tech or device issues if any. Ensure that you are connected to Internet.
              </p>
            </td>
          </tr>
        `;

        const userBody = body;
        const adminBody = abody;

        return {
          userBody: `${header({ title: 'Booking Confirmation', subTitle: 'Your Appointment booked' })}${userBody}${footer}`,
          adminBody: `${header({ title: `Booking Confirmation`, subTitle: `Appointment booked by ${data?.customerData?.firstName} ${data?.customerData?.lastName}` })}${adminBody}${footer}`,
        };
      }
      case "SERVICE_STATUS_CHANGE": {
        const start = data?.startTime ? new Date(data.startTime) : null;
        const dateStr = `${moment(data?.bookingDate).format("DD-MM-YYYY")}`;
        const minutes = `${data?.serviceData[0]?.durationInMinutes} minutes, ${data?.startTime}-${data?.endTime}` || "[minutes]";
        const place = data?.place || data?.mode || "Online";
        const serviceName = data?.serviceData[0]?.name || data?.service?.name || "Service";
        const astrologer = data?.astrologerProfile?.firstName ? `${data?.astrologerProfile?.firstName} ${data?.astrologerProfile?.lastName}` : "Please Check Dashboard";
        const meetingUrl = data?.meetingUrl || data?.zoomJoinUrl || "";
        const appointmentNote = data?.appointmentNote || data?.note || "";
        const astrologerStatus = data?.astrologerStatus || "PENDING";

        const meetingButton = meetingUrl
          ? `<p style="margin:14px 0 0;"><a href="${meetingUrl}" target="_blank" style="background:#f2703f; color:#fff; padding:10px 16px; text-decoration:none; border-radius:6px; display:inline-block;">Join Online Meeting</a></p>`
          : "";

        if (data?.astrologerStatus == 'accepted') {

          const body = `
          <tr>
            <td style="padding:14px 20px; color:#333; font-size:15px; line-height:22px;">
              <p>Hi <strong>${data?.customerData?.firstName || "Customer"}</strong>,</p>
              <p>Your Astrology consultancy session bas been Confirmed successfully. Below are the details of the booking :</p>

              <p style="margin:15px 0;">
                <strong>Booking ID:</strong> ${data?._id || "XXXXX"}<br/>
                <strong>Date:</strong> ${dateStr} for ${minutes}<br/>
                <strong>Place:</strong> ${place}<br/>
                <strong>Name of Service:</strong> ${serviceName}<br/>
                <strong>Astrologer:</strong> ${astrologer || "To be assigned"}<br/>
                <strong>Astrologer Status:</strong> <span style="color:${statusColors[astrologerStatus]}">${astrologerStatus}</span><br/>
                ${meetingButton}
              </p>

              ${appointmentNote ? `<p style="margin:15px 0;"><strong>Special Instructions:</strong> ${appointmentNote}</p>` : ""}

              <p style="margin:18px 0;">
                For Online booking please join the Zoom link at least 10 mins before start time so that you resolve tech or device issues if any. Ensure that you are connected to Internet.
              </p>
              <p style="margin:10px 0;">
                For Offline Pooja at your home, make sure that all arrangements are done as per the appointment note.
              </p>
            </td>
          </tr>
        `;

          const abody = `
          <tr>
            <td style="padding:14px 20px; color:#333; font-size:15px; line-height:22px;">
              <p>Hi <strong>${"Admin"}</strong>,</p>
              <p>The status has been updated for the session with the booking details below:</p>

              <p style="margin:15px 0;">
                <strong>Booking ID:</strong> ${data?._id || "XXXXX"}<br/>
                <strong>Date:</strong> ${dateStr} for ${minutes}<br/>
                <strong>Place:</strong> ${place}<br/>
                <strong>Name of Service:</strong> ${serviceName}<br/>
                <strong>Astrologer:</strong> ${astrologer || "To be assigned"}<br/>
                <strong>Customer:</strong> ${data?.customerData?.firstName || "Please check Dashboard"}<br/>
                <strong>Your Status:</strong> <span style="color:${statusColors[astrologerStatus]}">${astrologerStatus}</span><br/>
                ${meetingButton}
              </p>

              <p style="margin:18px 0;">
                For Online booking please join the Zoom link at least 10 mins before start time so that you resolve tech or device issues if any. Ensure that you are connected to Internet.
              </p>
            </td>
          </tr>
        `;

          const userBody = body;
          const adminBody = abody;

          return {
            userBody: `${header({ title: 'Booking Status Update', subTitle: 'Your Appointment is Confirmed.' })}${userBody}${footer}`,
            adminBody: `${header({ title: `Booking Status Update`, subTitle: `Status Update on booking by ${data?.customerData?.firstName} ${data?.customerData?.lastName}` })}${adminBody}${footer}`,
          };
        } else if (data?.astrologerStatus == 'rejected') {

          const body = `
          <tr>
            <td style="padding:14px 20px; color:#333; font-size:15px; line-height:22px;">
              <p>Hi <strong>${data?.customerData?.firstName || "Customer"}</strong>,</p>
              <p>We are Sorry to inform you that your appointment has been rejected.</p>
              <p>Your Amount will be refunded to original payment source within 4 working days.</p>
              
              <p>Booking Details:</p>

              <p style="margin:15px 0;">
                <strong>Booking ID:</strong> ${data?._id || "XXXXX"}<br/>
                <strong>Date:</strong> ${dateStr} for ${minutes}<br/>
                <strong>Place:</strong> ${place}<br/>
                <strong>Name of Service:</strong> ${serviceName}<br/>
                <strong>Astrologer:</strong> ${astrologer || "To be assigned"}<br/>
                <strong>Astrologer Status:</strong> <span style="color:${statusColors[astrologerStatus]}">${astrologerStatus}</span><br/>
                ${meetingButton}
              </p>

              ${appointmentNote ? `<p style="margin:15px 0;"><strong>Special Instructions:</strong> ${appointmentNote}</p>` : ""}

              <p style="margin:18px 0;">
              We recommend you to go our website or mobile App and do booking as per your next availability.  
              </p>
            </td>
          </tr>
        `;

          const abody = `
         <tr>
            <td style="padding:14px 20px; color:#333; font-size:15px; line-height:22px;">
              <p>Hi <strong>${"Admin"}</strong>,</p>
              <p>The status has been updated for the session with the booking details below:</p>

              <p style="margin:15px 0;">
                <strong>Booking ID:</strong> ${data?._id || "XXXXX"}<br/>
                <strong>Date:</strong> ${dateStr} for ${minutes}<br/>
                <strong>Place:</strong> ${place}<br/>
                <strong>Name of Service:</strong> ${serviceName}<br/>
                <strong>Astrologer:</strong> ${astrologer || "To be assigned"}<br/>
                <strong>Customer:</strong> ${data?.customerData?.firstName || "Please check Dashboard"}<br/>
                <strong>Your Status:</strong> <span style="color:${statusColors[astrologerStatus]}">${astrologerStatus}</span><br/>
                ${meetingButton}
              </p>
            </td>
          </tr>
        `;

          const userBody = body;
          const adminBody = abody;

          return {
            userBody: `${header({ title: 'Booking Status Update', subTitle: 'Your Appointment is Rejected.' })}${userBody}${footer}`,
            adminBody: `${header({ title: `Booking Status Update`, subTitle: `Appointment booked by ${data?.customerData?.firstName} ${data?.customerData?.lastName}` })}${adminBody}${footer}`,
          };
        }

      }
      case "USER_REGISTRATION": {
        const name =
          data?.customerData?.firstName ||
          data?.profile?.firstName ||
          data?.firstName ||
          "Customer";

        const body = `
            <tr>
              <td style="padding:14px 20px; color:#333; font-size:15px; line-height:22px;">
                <p>Hi <strong>${name}</strong>,</p>
                <p>Welcome to Soul Plan! Your account has been created successfully.</p>
                <p>We’re excited to have you on board. You can now explore products, book services, and receive helpful updates.</p>
                <p style="margin:14px 0 0;">
                  <a href="${process.env.APP_WEB_URL || 'https://www.soulplan.net/'}" target="_blank" style="background:#f2703f; color:#fff; padding:10px 16px; text-decoration:none; border-radius:6px; display:inline-block;">Go to Dashboard</a>
                </p>
              </td>
            </tr>
          `;

        return {
          userBody: `${header({ title: 'Welcome to Soul Plan', subTitle: 'Your account is ready' })}${body}${footer}`,
        };
      }
      case "FORGOT_PASSWORD": {
        // Extract the 6-digit OTP from data
        const otp = data?.otp || data?.verificationCode || "123456";
        const firstName = data?.firstName || data?.customerData?.firstName || "User";
        const email = data?.email || data?.customerData?.email || "user@example.com";
        
        // Format OTP with spaces for better readability
        const formattedOTP = otp.toString().split('').join(' ');
        
        // Forgot Password Body
        const userBody = `
          <tr>
            <td style="padding:25px 40px; color:#333; font-size:15px; line-height:22px;">
              <p>Hi <strong>${firstName}</strong>,</p>
              
              <p>We received a request to reset your password for your Astroguid account associated with <strong>${email}</strong>.</p>
              
              <p style="margin:25px 0; text-align:center;">
                <strong style="font-size:18px; display:block; margin-bottom:10px;">Your Verification Code:</strong>
                <span style="background:#f9f9f9; border:2px dashed #f2703f; padding:15px 25px; font-size:32px; font-weight:bold; letter-spacing:5px; color:#f2703f; display:inline-block; border-radius:8px;">
                  ${formattedOTP}
                </span>
              </p>
              
              <p><strong>Instructions:</strong></p>
              <ul style="margin:15px 0; padding-left:20px;">
                <li>Enter this 6-digit verification code on the password reset page</li>
                <li>This code is valid for the next <strong>2 minute</strong></li>
                <li>If you didn't request a password reset, please ignore this email</li>
                <li>For security reasons, do not share this code with anyone</li>
              </ul>
              
              <p style="margin-top:25px;">
                If you need further assistance, please contact our support team.
              </p>
              
              <p style="margin-top:20px;">
                <strong>Note:</strong> This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>
        `;
        
        // Admin notification (optional - if you want to notify admin about password reset requests)
        const adminBody = `
          <tr>
            <td style="padding:25px 40px; color:#333; font-size:15px; line-height:22px;">
              <p>Hello Admin,</p>
              
              <p>A password reset request has been initiated for the following user:</p>
              
              <p style="margin:15px 0; padding:15px; background:#f9f9f9; border-radius:6px;">
                <strong>User:</strong> ${firstName}<br/>
                <strong>Email:</strong> ${email}<br/>
                <strong>Time:</strong> ${new Date().toLocaleString("en-IN")}<br/>
                <strong>Request IP:</strong> ${data?.ipAddress || "Not available"}
              </p>
              
              <p>
                This is for your information. No action is required unless you suspect fraudulent activity.
              </p>
            </td>
          </tr>
        `;
        
        return {
          userBody: `${header({ title: 'Password Reset Request', subTitle: 'Secure your Astroguid account' })}${userBody}${footer}`,
          adminBody: `${header({ title: 'Password Reset Notification', subTitle: 'User requested password reset' })}${adminBody}${footer}`,
        };
      }

    }
  } catch (error) {
    console.log("Template Error:", error);
  }
}

async function templates(req, res) {
  try {
    const notificationFor = req.params.notificationFor;
    const audience = (req.query.audience || "user").toLowerCase();
    const data = {};
    const result = await generateTemplates(notificationFor, {
      orderStatus: "REFUNDED",
      paymentStatus: "REFUNDED",
    });
    if (!result) return res.status(404).send("Template not found");
    const html = audience === "admin" ? result.adminBody : result.userBody;
    return res.status(200).send(html);
  } catch (error) {
    return res.status(500).send(error.message || "Internal Server Error");
  }
}

module.exports = { templates, generateTemplates };
