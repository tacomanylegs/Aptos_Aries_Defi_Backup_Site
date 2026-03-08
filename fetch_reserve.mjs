import https from 'https';
import { writeFileSync } from 'fs';

const data = JSON.stringify({
  key_type: '0x1::type_info::TypeInfo',
  value_type: '0x9770fa9c725cbd97eb50b2be5f7416efdfd1f1554beb0750d4dae4c64e860da3::reserve_details::ReserveDetails',
  key: {
    account_address: '0x9770fa9c725cbd97eb50b2be5f7416efdfd1f1554beb0750d4dae4c64e860da3',
    module_name: '0x66615f746f5f636f696e5f77726170706572',
    struct_name: '0x5772617070656455534454'
  }
});

await new Promise((resolve, reject) => {
  const req = https.request({
    hostname: 'fullnode.mainnet.aptoslabs.com',
    path: '/v1/tables/0xdf52b2c83b75c52db5bb9f58fb39d9fc2e91b2d537f6498c07bf0f5175498db4/item',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  }, res => {
    let b = '';
    res.on('data', d => b += d);
    res.on('end', () => {
      try {
        const json = JSON.parse(b);
        const out =
          '=== interest_rate_config ===\n' + JSON.stringify(json.interest_rate_config, null, 2) +
          '\n=== reserve_config ===\n' + JSON.stringify(json.reserve_config, null, 2) +
          '\n=== totals ===\n' +
          'total_cash_available: ' + json.total_cash_available + '\n' +
          'total_borrowed.val: ' + json.total_borrowed?.val + '\n' +
          'total_lp_supply: ' + json.total_lp_supply + '\n';
        process.stdout.write(out);
        writeFileSync('reserve_pretty.txt', out);
        resolve();
      } catch(e) {
        process.stdout.write('Parse error: ' + e + '\nRaw: ' + b);
        reject(e);
      }
    });
  });
  req.on('error', e => { process.stderr.write(String(e)); reject(e); });
  req.write(data);
  req.end();
});
