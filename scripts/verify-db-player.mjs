/**
 * Kiem tra toan bo luong luu tru tren Database va xoa boi Admin
 */
async function test() {
  const BASE = 'http://localhost:3000';
  const KEY = 'triethanh-admin-2024';
  const NAME = 'NguoiChoiThuNghiem';

  console.log('1. Kiem tra ten chua ton tai:');
  let res = await fetch(BASE + '/api/check-name?name=' + encodeURIComponent(NAME));
  let data = await res.json();
  console.log('   check-name:', data);
  if (data.exists) throw new Error('Expected not exists');

  console.log('2. Tao nguoi choi moi tren DB:');
  res = await fetch(BASE + '/api/player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', name: NAME, gender: 'male', gameState: { answers: ['0:0:0'], world: 0 } })
  });
  data = await res.json();
  console.log('   player create:', data);
  if (!data.ok) throw new Error('Create failed');

  console.log('3. Kiem tra ten sau khi tao:');
  res = await fetch(BASE + '/api/check-name?name=' + encodeURIComponent(NAME));
  data = await res.json();
  console.log('   check-name:', data);
  if (!data.exists) throw new Error('Expected exists');

  console.log('4. Doc tien do tu DB:');
  res = await fetch(BASE + '/api/player?name=' + encodeURIComponent(NAME));
  data = await res.json();
  console.log('   player get:', data.player.name, data.player.gameState);
  if (!data.exists || data.player.gameState.answers.length !== 1) throw new Error('Get failed');

  console.log('5. Cap nhat tien do khi tra loi cau hoi:');
  res = await fetch(BASE + '/api/player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update', name: NAME, gender: 'male', gameState: { answers: ['0:0:0', '0:0:1'], world: 0 } })
  });
  data = await res.json();
  console.log('   player update:', data);
  if (!data.ok) throw new Error('Update failed');

  console.log('6. Admin kiem tra danh sach nguoi choi:');
  res = await fetch(BASE + '/api/admin?action=list&key=' + KEY);
  data = await res.json();
  const found = data.players.find(p => p.name === NAME);
  console.log('   admin list found player:', !!found, 'answered:', found?.answered);
  if (!found || found.answered !== 2) throw new Error('Admin list failed');

  console.log('7. Admin xoa nguoi choi:');
  res = await fetch(BASE + '/api/admin?action=delete-by-name&name=' + encodeURIComponent(NAME) + '&key=' + KEY, { method: 'DELETE' });
  data = await res.json();
  console.log('   admin delete:', data);
  if (!data.deleted) throw new Error('Admin delete failed');

  console.log('8. Kiem tra nguoi choi sau khi bi admin xoa:');
  res = await fetch(BASE + '/api/player?name=' + encodeURIComponent(NAME));
  data = await res.json();
  console.log('   player get after delete:', data);
  if (data.exists) throw new Error('Expected not exists after delete');

  console.log('9. Client dang choi gui sync tien do sau khi bi xoa:');
  res = await fetch(BASE + '/api/player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update', name: NAME, gender: 'male', gameState: { answers: ['0:0:0'] } })
  });
  data = await res.json();
  console.log('   player update after delete:', data);
  if (data.ok || !data.deleted) throw new Error('Expected deleted: true');

  console.log('10. Kiem tra ten da duoc giai phong:');
  res = await fetch(BASE + '/api/check-name?name=' + encodeURIComponent(NAME));
  data = await res.json();
  console.log('   check-name after delete:', data);
  if (data.exists) throw new Error('Expected name free');

  console.log('\n==== ALL 10 TESTS PASSED SUCCESSFULLY! ====');
}

test().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
