// testEmail.js - Script para probar el envío de emails
require('dotenv').config();
const { sendPaymentConfirmationEmail } = require('./services/emailService');

async function testPaymentEmail() {
  console.log('🧪 Iniciando prueba de email de confirmación de pago...\n');
  
  // ⚠️ CAMBIAR este email por tu email de prueba
  const testEmail = 'tu-email-de-prueba@gmail.com';
  
  const testPaymentData = {
    planName: 'Plan Premium Mensual',
    planId: 'premium-monthly',
    amount: 3000, // €30.00 en centavos
    sessionId: 'test_session_' + Date.now(),
    billingPeriod: 'monthly',
    purchaseDate: new Date().toLocaleDateString('es-ES')
  };

  try {
    console.log('📧 Enviando email de prueba a:', testEmail);
    console.log('📋 Datos del pago:', testPaymentData);
    console.log('');
    
    await sendPaymentConfirmationEmail(testEmail, testPaymentData);
    
    console.log('');
    console.log('✅ ¡Email enviado exitosamente!');
    console.log('📬 Revisa tu bandeja de entrada en:', testEmail);
    console.log('');
    console.log('💡 Consejos:');
    console.log('   - Si no lo ves, revisa spam/correo no deseado');
    console.log('   - Verifica que EMAIL_USER y EMAIL_PASS estén correctos en .env');
    console.log('   - Asegúrate de usar una App Password de Gmail');
    
  } catch (error) {
    console.error('');
    console.error('❌ Error enviando email de prueba:');
    console.error('   Mensaje:', error.message);
    console.error('');
    console.error('🔧 Posibles soluciones:');
    console.error('   1. Verifica EMAIL_USER en .env');
    console.error('   2. Verifica EMAIL_PASS en .env (debe ser App Password)');
    console.error('   3. Activa "Verificación en 2 pasos" en Gmail');
    console.error('   4. Genera una nueva App Password en Google Account');
    console.error('');
    console.error('📖 Más info: https://support.google.com/accounts/answer/185833');
  }
}

// Ejecutar la prueba
testPaymentEmail();