# WebSocket Testing Guide for Postman

This guide explains how to test the WebSocket implementation for `get-all-call-astrologers` in Postman.

## Prerequisites

1. **Start your server** (default port: 3000)
   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. **Postman version**: Make sure you're using Postman v10.0 or later (WebSocket support was added in v10.0)

## Testing Steps

### Step 1: Create a WebSocket Connection in Postman

1. **Open Postman** and create a new request
2. **Change the request type** from `GET` to `WebSocket` (you'll see this option in the dropdown)
3. **Enter the WebSocket URL**:
   ```
   ws://localhost:3000/socket.io/?EIO=4&transport=websocket
   ```
   Or if your server is running on a different host/port:
   ```
   ws://YOUR_HOST:YOUR_PORT/socket.io/?EIO=4&transport=websocket
   ```
   Note: Replace `YOUR_HOST` and `YOUR_PORT` with your actual server details.

4. **Click "Connect"** - You should see a connection established message

### Step 2: Subscribe to Call Astrologers Updates

Once connected, you need to subscribe to receive updates. In Postman's WebSocket message composer:

1. **Send a subscription message**:
   ```json
   42["subscribe:call-astrologers"]
   ```
   
   **Explanation**: 
   - `42` is Socket.IO's message type for events
   - `["subscribe:call-astrologers"]` is the event name in an array format

2. You should see a response or confirmation in the server logs:
   ```
   📡 Client <socket-id> subscribed to call-astrologers updates
   ```

### Step 3: Trigger the Webhook (Simulate Call Hangup)

Now, in a **separate Postman tab** (or use a different tool), trigger the webhook endpoint:

1. **Create a new HTTP POST request** in Postman
2. **URL**: 
   ```
   http://localhost:3000/api/call/webhook/call-hangup
   ```
3. **Method**: `POST`
4. **Headers**: 
   ```
   Content-Type: application/json
   ```
5. **Body** (raw JSON):
   ```json
   {
     "custom_identifier": "YOUR_CALL_ID_HERE",
     "call_status": "completed",
     "billsec": "120",
     "start_stamp": "2024-01-15T10:00:00Z",
     "end_stamp": "2024-01-15T10:02:00Z"
   }
   ```
   
   **Note**: Replace `YOUR_CALL_ID_HERE` with an actual call ID from your database, or use a test call ID that exists in your `CallAstrologer` collection.

6. **Send the request**

### Step 4: Observe the WebSocket Event

After sending the webhook request, **go back to your WebSocket connection** in Postman. You should see a message like:

```json
42["call-astrologers:updated",{"employeeId":"...","userId":"...","isBusy":false,"message":"Employee status updated - call ended"}]
```

This confirms that:
- ✅ The webhook was triggered
- ✅ The employee status was updated
- ✅ The WebSocket event was emitted
- ✅ You received the update in real-time

## Alternative: Using Socket.IO Client Library (for more detailed testing)

If you want more detailed testing, you can also use a simple Node.js script:

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3000', {
  transports: ['websocket', 'polling']
});

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
  
  // Subscribe to updates
  socket.emit('subscribe:call-astrologers');
  console.log('📡 Subscribed to call-astrologers updates');
});

socket.on('call-astrologers:updated', (data) => {
  console.log('📥 Received update:', data);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected');
});
```

## Testing Checklist

- [ ] WebSocket connection established
- [ ] Successfully subscribed to `call-astrologers` updates
- [ ] Webhook endpoint triggered successfully
- [ ] Received `call-astrologers:updated` event via WebSocket
- [ ] Event contains correct employee data (`isBusy: false`)
- [ ] Server logs show the emission

## Troubleshooting

### Issue: Cannot connect to WebSocket
- **Solution**: Make sure your server is running and the port is correct
- Check if Socket.IO is properly initialized (check server logs)

### Issue: Not receiving events
- **Solution**: Make sure you've subscribed by sending `42["subscribe:call-astrologers"]`
- Check server logs to confirm the subscription was successful
- Verify the webhook was actually triggered and processed

### Issue: Webhook returns 200 but no WebSocket event
- **Solution**: Check server logs for errors
- Verify the `custom_identifier` matches an existing call in the database
- Ensure the call status is "pending" (not already processed)

## Expected Server Logs

When everything works correctly, you should see:

```
🔌 Socket.IO initialized
✅ Client connected: <socket-id>
📡 Client <socket-id> subscribed to call-astrologers updates
📞 webhookCallHangup body: { ... }
✅ Call <call-id> closed | Status: accepted | Charged: <amount>
📤 Emitted call-astrologers update to subscribed clients
```

