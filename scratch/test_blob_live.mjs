import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { put } from '@vercel/blob';

async function testVercelBlob() {
  console.log('Testing Vercel Blob Private Store...');
  const sampleBuffer = Buffer.from('ObraSaaS Enterprise Private Evidence Test ' + new Date().toISOString(), 'utf-8');
  
  try {
    const blob = await put('evidence-test/obrasaas-audit-proof.txt', sampleBuffer, {
      access: 'private',
      contentType: 'text/plain',
      addRandomSuffix: true
    });
    console.log('✅ Successfully uploaded to Private Vercel Blob Storage!');
    console.log('📍 Blob URL:', blob.url);
    console.log('📦 Download URL:', blob.downloadUrl);
  } catch (err) {
    console.error('❌ Blob upload error:', err.message);
  }
}

testVercelBlob();
