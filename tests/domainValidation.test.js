// tests/domainValidation.test.js
const axios = require('axios');

const API_BASE = process.env.API_URL || 'http://localhost:3000';

// ⚠️ CONFIGURAR ANTES DE EJECUTAR:
const TEST_API_KEY = 'c384bc1bd3bd58a1dbc9c99e9a32dbc918487374c1aba4688665d023ebcc85df'; // Obtener desde tu BD o dashboard
const TEST_DOMAIN = 'popeye.com'; // Tu dominio registrado (sin https://)

/**
 * Suite de tests para validación de dominios
 */
async function runTests() {
  console.log('🧪 Iniciando tests de validación de dominios');
  console.log('📍 API Base:', API_BASE);
  console.log('🔑 API Key:', TEST_API_KEY.substring(0, 10) + '...');
  console.log('🌐 Dominio de prueba:', TEST_DOMAIN);
  console.log('');

  // Test 1: Request desde dominio autorizado
  await test1_AuthorizedDomain();

  // Test 2: Request desde dominio NO autorizado
  await test2_UnauthorizedDomain();

  // Test 3: Request sin Origin header
  await test3_MissingOrigin();

  // Test 4: Request con API key inválida
  await test4_InvalidApiKey();

  // Test 5: Request desde subdominio
  await test5_Subdomain();

  // Test 6: CORS preflight
  await test6_CorsPreflight();

  console.log('\n✅ Tests completados');
}

/**
 * Test 1: Request desde dominio autorizado ✅
 */
async function test1_AuthorizedDomain() {
  console.log('📝 Test 1: Request desde dominio autorizado');
  
  try {
    const response = await axios.get(`${API_BASE}/widget.html`, {
      params: { apikey: TEST_API_KEY },
      headers: {
        'Origin': `https://${TEST_DOMAIN}`
      },
      maxRedirects: 0,
      validateStatus: (status) => status < 500 // Aceptar cualquier código < 500
    });

    if (response.status === 200) {
      console.log('   ✅ PASS: Request autorizado correctamente');
      console.log('   Status:', response.status);
    } else {
      console.log('   ⚠️  WARNING: Status inesperado:', response.status);
    }
  } catch (error) {
    console.log(`   ❌ FAIL: ${error.response?.data?.error || error.message}`);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', error.response.data?.substring(0, 200));
    }
  }
  console.log('');
}

/**
 * Test 2: Request desde dominio NO autorizado ❌
 */
async function test2_UnauthorizedDomain() {
  console.log('📝 Test 2: Request desde dominio NO autorizado');
  
  try {
    const response = await axios.get(`${API_BASE}/widget.html`, {
      params: { apikey: TEST_API_KEY },
      headers: {
        'Origin': 'https://sitio-malicioso.com' // ⬅️ Dominio NO registrado
      },
      maxRedirects: 0,
      validateStatus: (status) => status < 500
    });

    if (response.status === 403) {
      console.log('   ✅ PASS: Dominio bloqueado correctamente');
    } else {
      console.log('   ❌ FAIL: Debería haber bloqueado el request');
      console.log('   Status recibido:', response.status);
    }
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('   ✅ PASS: Dominio bloqueado correctamente');
      console.log('   Mensaje:', error.response.data?.error || 'Bloqueado');
    } else {
      console.log(`   ⚠️  UNEXPECTED: ${error.message}`);
    }
  }
  console.log('');
}

/**
 * Test 3: Request sin Origin header
 */
async function test3_MissingOrigin() {
  console.log('📝 Test 3: Request sin Origin header');
  
  try {
    // Axios siempre agrega headers, así que usamos un request básico
    const response = await axios.get(`${API_BASE}/widget.html?apikey=${TEST_API_KEY}`, {
      headers: {}, // Sin headers personalizados
      validateStatus: () => true
    });
    
    if (process.env.NODE_ENV === 'production') {
      if (response.status === 403) {
        console.log('   ✅ PASS: Bloqueado en producción');
      } else {
        console.log('   ❌ FAIL: Debería bloquear en producción');
      }
    } else {
      // En desarrollo, debería permitir (localhost)
      if (response.status === 200) {
        console.log('   ✅ PASS: Permitido en desarrollo');
      } else {
        console.log('   ⚠️  INFO: Modo desarrollo - status:', response.status);
      }
    }
  } catch (error) {
    console.log('   ⚠️  INFO: Test 3 completado con advertencia');
  }
  console.log('');
}
/**
 * Test 4: Request con API key inválida ❌
 */
async function test4_InvalidApiKey() {
  console.log('📝 Test 4: API Key inválida');
  
  try {
    const response = await axios.get(`${API_BASE}/widget.html`, {
      params: { apikey: 'clave-invalida-12345' },
      headers: {
        'Origin': `https://${TEST_DOMAIN}`
      },
      maxRedirects: 0,
      validateStatus: (status) => status < 500
    });

    if (response.status === 403) {
      console.log('   ✅ PASS: API key inválida rechazada');
    } else {
      console.log('   ❌ FAIL: Debería rechazar API key inválida');
      console.log('   Status:', response.status);
    }
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('   ✅ PASS: API key inválida rechazada');
    } else {
      console.log('   ⚠️  ERROR:', error.message);
    }
  }
  console.log('');
}

/**
 * Test 5: Request desde subdominio ✅ (si está habilitado)
 */
async function test5_Subdomain() {
  console.log('📝 Test 5: Request desde subdominio');
  
  try {
    const response = await axios.get(`${API_BASE}/widget.html`, {
      params: { apikey: TEST_API_KEY },
      headers: {
        'Origin': `https://blog.${TEST_DOMAIN}` // ⬅️ Subdominio
      },
      maxRedirects: 0,
      validateStatus: (status) => status < 500
    });

    if (response.status === 200) {
      console.log('   ✅ PASS: Subdominio permitido correctamente');
    } else if (response.status === 403) {
      console.log('   ⚠️  INFO: Subdominios no habilitados (configurable)');
    } else {
      console.log('   ⚠️  WARNING: Status inesperado:', response.status);
    }
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('   ⚠️  INFO: Subdominios no habilitados (esto es configurable)');
    } else {
      console.log('   ❌ FAIL:', error.message);
    }
  }
  console.log('');
}

/**
 * Test 6: CORS Preflight (OPTIONS request)
 */
async function test6_CorsPreflight() {
  console.log('📝 Test 6: CORS Preflight');
  
  try {
    const response = await axios.options(`${API_BASE}/widget.html`, {
      params: { apikey: TEST_API_KEY },
      headers: {
        'Origin': `https://${TEST_DOMAIN}`,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'X-API-Key'
      },
      validateStatus: (status) => status < 500
    });

    if (response.status === 204 || response.status === 200) {
      console.log('   ✅ PASS: CORS preflight correcto');
      console.log('   Allow-Origin:', response.headers['access-control-allow-origin'] || 'No especificado');
    } else {
      console.log('   ⚠️  WARNING: Status inesperado:', response.status);
    }
  } catch (error) {
    console.log(`   ❌ FAIL: ${error.message}`);
  }
  console.log('');
}

/**
 * 🔧 Tests manuales adicionales con curl
 */
function printManualTests() {
  console.log('\n📋 Tests manuales con curl:\n');
  
  console.log('1️⃣ Test dominio autorizado:');
  console.log(`curl -v \\
     -H "Origin: https://${TEST_DOMAIN}" \\
     "${API_BASE}/widget.html?apikey=${TEST_API_KEY}"\n`);
  
  console.log('2️⃣ Test dominio NO autorizado:');
  console.log(`curl -v \\
     -H "Origin: https://sitio-malicioso.com" \\
     "${API_BASE}/widget.html?apikey=${TEST_API_KEY}"\n`);
  
  console.log('3️⃣ Test sin Origin (desarrollo):');
  console.log(`curl -v \\
     "${API_BASE}/widget.html?apikey=${TEST_API_KEY}"\n`);
  
  console.log('4️⃣ Test CORS preflight:');
  console.log(`curl -v -X OPTIONS \\
     -H "Origin: https://${TEST_DOMAIN}" \\
     -H "Access-Control-Request-Method: GET" \\
     "${API_BASE}/widget.html?apikey=${TEST_API_KEY}"\n`);
  
  console.log('5️⃣ Test subdominio:');
  console.log(`curl -v \\
     -H "Origin: https://blog.${TEST_DOMAIN}" \\
     "${API_BASE}/widget.html?apikey=${TEST_API_KEY}"\n`);
}

// Ejecutar tests
if (require.main === module) {
  runTests()
    .then(() => printManualTests())
    .catch(console.error);
}

module.exports = { runTests };