/**
 * OAuth Callback Route for OneDrive Integration
 * Handles the redirect from Microsoft OAuth and displays the authorization code
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const state = searchParams.get('state');

    // Handle error case
    if (error) {
      return NextResponse.json(
        {
          error: error,
          error_description: errorDescription || 'An error occurred during authentication',
          state: state,
        },
        { status: 400 }
      );
    }

    // Handle success case - return the code
    if (code) {
      // Return a simple HTML page with the code and instructions
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>OAuth Callback - Authorization Code</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            h1 {
              color: #333;
              margin-bottom: 20px;
            }
            .code-box {
              background: #f8f9fa;
              border: 1px solid #dee2e6;
              border-radius: 4px;
              padding: 15px;
              margin: 20px 0;
              word-break: break-all;
              font-family: monospace;
              font-size: 14px;
            }
            .instructions {
              background: #e7f3ff;
              border-left: 4px solid #2196F3;
              padding: 15px;
              margin: 20px 0;
            }
            .button {
              background: #2196F3;
              color: white;
              padding: 10px 20px;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
              margin-top: 10px;
            }
            .button:hover {
              background: #1976D2;
            }
            .success {
              color: #4caf50;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">✅ Authorization Successful!</h1>
            <p>Your authorization code has been received. Copy the code below and use it to get your refresh token.</p>
            
            <h2>Authorization Code:</h2>
            <div class="code-box" id="codeBox">${code}</div>
            <button class="button" onclick="copyCode()">Copy Code</button>
            
            <div class="instructions">
              <h3>Next Steps:</h3>
              <ol>
                <li>Copy the authorization code above</li>
                <li>Use this curl command to exchange it for tokens (replace YOUR values):</li>
                <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">
curl -X POST https://login.microsoftonline.com/YOUR_TENANT_ID/oauth2/v2.0/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET" \\
  -d "code=${code}" \\
  -d "redirect_uri=https://ims.prepservicesfba.com/api/auth/callback" \\
  -d "grant_type=authorization_code"
                </pre>
                <li>From the response, copy the <strong>refresh_token</strong> value</li>
                <li>Add it to your <code>.env.local</code> file as <code>ONEDRIVE_REFRESH_TOKEN</code></li>
              </ol>
            </div>
          </div>
          
          <script>
            function copyCode() {
              const codeBox = document.getElementById('codeBox');
              const text = codeBox.textContent;
              navigator.clipboard.writeText(text).then(() => {
                alert('Code copied to clipboard!');
              });
            }
          </script>
        </body>
        </html>
      `;

      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }

    // No code or error - accessed directly without OAuth redirect
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Callback - Waiting for Authorization</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          h1 {
            color: #333;
            margin-bottom: 20px;
          }
          .info {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>OAuth Callback Route</h1>
          <div class="info">
            <p><strong>This route is working correctly!</strong></p>
            <p>This endpoint is used by Microsoft OAuth to redirect after authorization.</p>
            <p>To get your authorization code:</p>
            <ol>
              <li>Use the authorization URL with your credentials</li>
              <li>Microsoft will redirect you back here with a code parameter</li>
              <li>You'll see your authorization code on this page</li>
            </ol>
          </div>
        </div>
      </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'An error occurred processing the OAuth callback',
      },
      { status: 500 }
    );
  }
}

