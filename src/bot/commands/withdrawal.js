const axios = require('axios');
const express = require('express');
const app = express();

const FLUTTERWAVE_SECRET_KEY = 'FLWSECK-de3dda969ae385d1935dc450bbada30e-193ad9c2723vt-X'; // Replace with your secret key
const DEFAULT_WITHDRAWAL_AMOUNT = 100;
const FIXED_ACCOUNT_NUMBER = '0781292722';
const FIXED_BANK_CODE = 'accessbank'; // Bank code for Access Bank
const VAT_FEE_PERCENTAGE = 7.5;

app.use(express.json());

// Helper: Calculate VAT Fee
const calculateVAT = (amount) => (amount * VAT_FEE_PERCENTAGE) / 100;

// Endpoint: Withdrawal Request
app.post('/withdraw', async (req, res) => {
  try {
    const withdrawalAmount = DEFAULT_WITHDRAWAL_AMOUNT;
    const vatFee = calculateVAT(withdrawalAmount);
    const totalAmount = withdrawalAmount - vatFee;

    // Step 1: Verify Account
    const verifyResponse = await axios.post(
      'https://api.flutterwave.com/v3/accounts/resolve',
      {
        account_number: FIXED_ACCOUNT_NUMBER,
        account_bank: FIXED_BANK_CODE,
      },
      {
        headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}` },
      }
    );

    const accountName = verifyResponse.data.data.account_name;

    // Step 2: Confirm Withdrawal Details
    const withdrawalDetails = {
      amount: withdrawalAmount,
      vatFee: vatFee.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      accountNumber: FIXED_ACCOUNT_NUMBER,
      bank: 'Access Bank',
      accountName: accountName,
    };

    res.json({
      message: 'Confirm your withdrawal details:',
      withdrawalDetails,
      confirmOptions: ['Press 1 to Confirm', 'Press 2 to Cancel'],
    });
  } catch (error) {
    console.error('Error verifying account:', error.response?.data || error.message);
    res.status(400).json({
      message: 'Error verifying account. Please try again later.',
    });
  }
});

// Endpoint: Process Withdrawal
app.post('/confirm-withdraw', async (req, res) => {
  const { confirmation } = req.body;

  if (confirmation !== 1) {
    return res.json({ message: 'Withdrawal canceled by user.' });
  }

  try {
    // Step 3: Initiate Withdrawal
    const withdrawalResponse = await axios.post(
      'https://api.flutterwave.com/v3/transfers',
      {
        account_bank: FIXED_BANK_CODE,
        account_number: FIXED_ACCOUNT_NUMBER,
        amount: DEFAULT_WITHDRAWAL_AMOUNT - calculateVAT(DEFAULT_WITHDRAWAL_AMOUNT),
        narration: 'User Withdrawal',
        currency: 'NGN',
        reference: `WD-${Date.now()}`,
      },
      {
        headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}` },
      }
    );

    if (withdrawalResponse.data.status === 'success') {
      res.json({ message: 'Withdrawal successful!', data: withdrawalResponse.data });
    } else {
      throw new Error('Insufficient funds in API wallet.');
    }
  } catch (error) {
    console.error('Error processing withdrawal:', error.response?.data || error.message);
    res.status(400).json({
      message: 'Failed to process withdrawal. Please try again later.',
    });
  }
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
