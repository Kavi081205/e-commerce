import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import paymentRoutes from './routes/payment.js';
import ordersHandler from './orders.js';
import complaintsHandler from './complaints.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// Mock pincode route for shipping calculations
app.get('/api/pincode/:code', (req, res) => {
  const { code } = req.params;
  return res.status(200).json([
    {
      "Message": "Number of pincode(s) found:1",
      "Status": "Success",
      "PostOffice": [
        {
          "Name": "Mock Post Office",
          "Description": null,
          "BranchType": "Sub Post Office",
          "DeliveryStatus": "Delivery",
          "Circle": "Mock Circle",
          "District": "Mock District",
          "Division": "Mock Division",
          "Region": "Mock Region",
          "State": "Mock State",
          "Country": "India",
          "Pincode": code
        }
      ]
    }
  ]);
});

// Mount the payment routes at root level so full paths '/api/...' match exactly
app.use(paymentRoutes);

// Mount orders and complaints routes
app.get('/api/orders', ordersHandler);
app.get('/api/complaints', complaintsHandler);

// Export for Vite dev server middleware and Vercel serverless integration
export default app;
