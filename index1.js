const mqtt = require('mqtt');
const express = require('express');
const mongoose = require('mongoose');
const app = express();
app.use(express.json());

// ✅ MongoDB se connect ho rahe hain
mongoose.connect('mongodb://localhost:27017/mqtt_messages')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ✅ Mongoose Schema aur Model define kar rahe hain
const messageSchema = new mongoose.Schema({
  deviceId: String,
  topic: String,
  payload: mongoose.Schema.Types.Mixed, // Kisi bhi tarah ka JSON data store karne ke liye
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// ✅ MQTT broker se connect ho rahe hain
const client = mqtt.connect('mqtt://test.mosquitto.org');

client.on('connect', () => {
  console.log("✅ Connected to MQTT broker");

  // 1st topic to send msg from myMQTT
  client.subscribe('device/+/to/server', (err) => {
    if (!err) {
      console.log("📩 Subscribed to all device messages");
    }
  });

  // 2nd topic to send msg from myMQTT
  client.subscribe('device/+/to/server2', (err) => {
    if (!err) {
      console.log("📩 Subscribed to all device messages");
    }
  });
});


// ✅ Jab MQTT se koi message aata hai, usko process aur MongoDB me store kar dete hain
client.on('message', (topic, message) => {
  const topicParts = topic.split('/');  // Example: ['device', 'device123', 'to', 'server']
  const deviceId = topicParts[1];  // 'device123'

  try {
    const msg = JSON.parse(message.toString().trim()); // JSON parse kar rahe hain
    console.log(`📥 Received from [${deviceId}]:`, msg);

    // MongoDB me message save kar rahe hain
    const msgDoc = new Message({ deviceId, topic, payload: msg });
    msgDoc.save()
      .then(() => console.log(`💾 Message saved to MongoDB for device [${deviceId}]`))
      .catch(err => console.error(`❌ Error saving message for device [${deviceId}]:`, err));

  } catch (error) {
    console.log(`❌ JSON Parse Error from [${deviceId}]:`, message.toString());
  }
});


// ✅ **POST API for Sending MQTT Message**
app.post('/send', (req, res) => {
  const { message, deviceId } = req.body;  
  if (!message || !deviceId) {
    return res.status(400).json({ error: 'Message & deviceId are required' });
  }

  const topic = `server/to/device/${deviceId}`;  // Dynamic Device ID
  const payload = JSON.stringify(message);  // JSON format me message bhejna

  client.publish(topic, payload);

  console.log(`📤 Sent to [${deviceId}]:`, message);
  res.json({ success: true, message: `Sent to [${deviceId}]: ${JSON.stringify(message)}` });
});

// ✅ **Server Start**
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
});
