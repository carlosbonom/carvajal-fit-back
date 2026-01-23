import axios from 'axios';

async function createTestUser() {
    const ACCESS_TOKEN = 'TEST-7212593378243672-092412-1385bddde1fe45bf0a472fd6e25f3f98-274687249';

    try {
        console.log('Creating Test User...');
        const response = await axios.post(
            'https://api.mercadopago.com/users/test_user',
            {
                site_id: 'MLC', // Chile
                description: 'Test User for Carvajal Fit Subscriptions'
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ACCESS_TOKEN}`
                }
            }
        );

        console.log('=== User Created Successfully ===');
        console.log('Email:', response.data.email);
        console.log('Password:', response.data.password);
        console.log('ID:', response.data.id);
        console.log('Nickname:', response.data.nickname);
        console.log('Site ID:', response.data.site_id);
        console.log('=================================');

    } catch (error: any) {
        console.error('Error creating user:', error.response?.data || error.message);
    }
}

createTestUser();
