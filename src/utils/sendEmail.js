import https from 'https';

// email via resend api
const sendEmail = async ({ to, subject, text, html }) => {
    try {
        const apiKey = process.env.RESEND_API_KEY;
        const fromEmail = process.env.RESEND_FROM || 'Earnify <onboarding@resend.dev>';

        if (!apiKey) {
            console.error("Resend API Key is missing in environment variables!");
            return false;
        }

        const data = JSON.stringify({
            from: fromEmail,
            to: Array.isArray(to) ? to : [to],
            subject: subject,
            text: text,
            html: html || text,
        });

        const options = {
            hostname: 'api.resend.com',
            port: 443,
            path: '/emails',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(data),
            },
        };

        const response = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let responseBody = '';
                res.on('data', (chunk) => {
                    responseBody += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(responseBody));
                        } catch (parseError) {
                            resolve({ id: 'unknown', body: responseBody });
                        }
                    } else {
                        reject(new Error(`Resend API Error: ${res.statusCode} - ${responseBody}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            // Set an explicit connection/socket timeout of 8 seconds
            req.setTimeout(8000, () => {
                req.destroy(new Error('Request Timeout (8s)'));
            });

            req.write(data);
            req.end();
        });

        console.log(`Email sent successfully via Resend. ID: ${response.id}`);
        return true;
    } catch (error) {
        console.error(`Error sending email via Resend: ${error.message}`);
        return false;
    }
};

export default sendEmail;
