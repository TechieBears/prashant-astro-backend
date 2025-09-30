const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    console.log("send email inside start", options.email);
    let transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        // secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER, // generated ethereal user
            pass: process.env.SMTP_PASS, // generated ethereal password
        },
    });

    // send mail with defined transport object
    let info = await transporter.sendMail({
        from: process.env.SMTP_USER, // sender address
        to: options.email, // list of receivers
        subject: options.subject, // Subject line
        html: options.message, // plain text body
    });

    if (info) {
        console.log("Email sent: " + info.response);
    }
};

module.exports = sendEmail;
