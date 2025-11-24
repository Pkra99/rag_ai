const Redis = require('ioredis');
require('dotenv').config({ path: '.env.local' });

const url = process.env.REDIS_URL;

console.log('Testing Redis Connection...');
console.log('URL found:', url ? 'Yes' : 'No');
if (url) {
    // Mask password for display
    const masked = url.replace(/:([^:@]+)@/, ':****@');
    console.log('URL format:', masked);
}

const redis = new Redis(url);

redis.on('error', (err) => {
    console.error('❌ Redis Connection Error:', err.message);
    process.exit(1);
});

redis.on('connect', () => {
    console.log('✅ Connected to Redis!');
    redis.ping().then((res) => {
        console.log('✅ Ping response:', res);
        console.log('🎉 Redis connection is working correctly.');
        redis.disconnect();
    });
});
