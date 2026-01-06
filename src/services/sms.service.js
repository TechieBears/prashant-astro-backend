"use strict";

const { URLSearchParams } = require("url");

/**
 * Send DLT-compliant SMS via Route Mobile
 *
 * @param {Object} options
 * @param {string} options.toNumber - Mobile number (e.g., "9768772343")
 * @param {string} options.message - SMS content (must match DLT template exactly)
 * @param {string} options.entityId - DLT Entity ID
 * @param {string} options.templateId - DLT Template ID (tempid)
 * @param {string} [options.username=process.env.RML_USERNAME] - RML username
 * @param {string} [options.password=process.env.RML_PASSWORD] - RML password
 * @param {string} [options.senderId=process.env.RML_SENDER_ID] - Sender ID (approved header)
 * @param {string} [options.endpoint=process.env.RML_SMS_ENDPOINT] - RML endpoint
 * @returns {Promise<{status:number, body:any}>}
 */
async function sendSMSTemplate({
    toNumber,
    message,
    entityId,
    templateId,
    username = process.env.RML_USERNAME,
    password = process.env.RML_PASSWORD,
    senderId = process.env.RML_SENDER_ID,
    endpoint = process.env.RML_SMS_ENDPOINT || "http://sms6.rmlconnect.net:8080/bulksms/bulksms",
}) {
    if (!toNumber) throw new Error("toNumber is required");
    if (!message) throw new Error("message is required");
    if (!entityId) throw new Error("entityId is required");
    if (!templateId) throw new Error("templateId is required");
    if (!username || !password) throw new Error("RML username/password missing");
    if (!senderId) throw new Error("senderId is required");

    const params = new URLSearchParams({
        username,
        password,
        type: "0", // DLT compliant
        dlr: "1",
        destination: toNumber,
        source: senderId,
        entityid: entityId,
        tempid: templateId,
        message,
    });

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
    });

    const body = await response.text(); // RML API returns plain text or JSON
    return { status: response.status, body };
}

module.exports = { sendSMSTemplate };
