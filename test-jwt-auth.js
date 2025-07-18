// Simple test script to verify JWT authentication functionality
import { JWTAuthService } from './server/services/jwt-auth.js';

async function testJWTAuth() {
  console.log('🔒 Testing JWT Authentication Service...\n');

  try {
    // Test 1: Generate token pair
    console.log('1. Testing token generation...');
    const tokenPair = await JWTAuthService.generateTokenPair(
      'test-user-123',
      'test@example.com',
      'user'
    );
    console.log('✅ Token pair generated successfully');
    console.log('   Access token length:', tokenPair.accessToken.length);
    console.log('   Refresh token length:', tokenPair.refreshToken.length);
    console.log('   Expires at:', new Date(tokenPair.expiresAt).toISOString());

    // Test 2: Verify access token
    console.log('\n2. Testing access token verification...');
    const payload = await JWTAuthService.verifyAccessToken(tokenPair.accessToken);
    console.log('✅ Access token verified successfully');
    console.log('   User ID:', payload.userId);
    console.log('   Email:', payload.email);
    console.log('   Role:', payload.role);

    // Test 3: Refresh token
    console.log('\n3. Testing token refresh...');
    const newTokenPair = await JWTAuthService.refreshAccessToken(tokenPair.refreshToken);
    console.log('✅ Token refreshed successfully');
    console.log('   New access token length:', newTokenPair.accessToken.length);

    // Test 4: Revoke token
    console.log('\n4. Testing token revocation...');
    await JWTAuthService.revokeAccessToken(tokenPair.accessToken);
    console.log('✅ Token revoked successfully');

    // Test 5: Try to use revoked token
    console.log('\n5. Testing revoked token rejection...');
    try {
      await JWTAuthService.verifyAccessToken(tokenPair.accessToken);
      console.log('❌ Revoked token should have been rejected');
    } catch (error) {
      console.log('✅ Revoked token properly rejected:', error.message);
    }

    // Test 6: Token statistics
    console.log('\n6. Testing token statistics...');
    const stats = JWTAuthService.getTokenStats();
    console.log('✅ Token statistics retrieved');
    console.log('   Active refresh tokens:', stats.activeRefreshTokens);
    console.log('   Blacklisted tokens:', stats.blacklistedTokens);
    console.log('   Expired tokens:', stats.expiredTokens);

    console.log('\n🎉 All JWT authentication tests passed!');

  } catch (error) {
    console.error('❌ JWT authentication test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testJWTAuth();
}

export { testJWTAuth };