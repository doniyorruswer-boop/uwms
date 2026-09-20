const API = 'http://localhost:4000/api';

async function testPurchaseChain() {
  console.log('=== UWMS PHASE L1: 7-BOSQICH UNIVERSITET XARID ZANJIRI E2E TEST ===\n');

  // Helper login
  async function login(username: string) {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'admin123' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Login failed for ${username}: ${JSON.stringify(data)}`);
    return data.access_token || data.accessToken;
  }

  try {
    // 1. Mudir / Admin Login
    console.log('[1/7] Kafedra mudiri nomidan tizimga kirish va yangi talabnoma yaratish...');
    const adminToken = await login('admin');
    
    // Fetch existing request to get a valid catalog itemId
    const reqListRes = await fetch(`${API}/requests`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const reqList = await reqListRes.json();
    const existingItem = reqList[0]?.items?.[0] || { itemId: 'ITEM-DEFAULT', itemName: 'Sarf Tovari', unit: 'DONA' };

    // Create request
    const createReq = await fetch(`${API}/requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            itemId: existingItem.itemId,
            itemName: existingItem.itemName,
            quantity: 1,
            unit: existingItem.unit || 'DONA',
          },
        ],
        purpose: 'Kafedra professor-o‘qituvchilari va o‘quv jarayoni uchun sarf tovarlari xaridi',
      }),
    });
    const createData = await createReq.json();
    if (!createReq.ok) throw new Error(`Create failed: ${JSON.stringify(createData)}`);

    const requestId = createData.id;
    const reqNum = createData.requestNumber;
    console.log(`✅ 1-Bosqich: Talabnoma yaratildi! ID: ${requestId}, Raqam: ${reqNum}, Status: ${createData.status}`);

    // 2. Prorektor Vizasi
    console.log('\n[2/7] Moliya-iqtisod prorektori (VICE_RECTOR_FINANCE) vizasi...');
    const prorektorToken = await login('prorektor_moliya');
    const prorektorReq = await fetch(`${API}/requests/${requestId}/workflow-advance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${prorektorToken}`,
      },
      body: JSON.stringify({
        status: 'APPROVED_BY_PRORECTOR',
        note: 'Moliya-iqtisodiyot masalalari bo‘yicha prorektor tomonidan xaridga viza qo‘yildi (QR-Pairing Biometrik)',
      }),
    });
    const prorektorData = await prorektorReq.json();
    if (!prorektorReq.ok) throw new Error(`Prorektor failed: ${JSON.stringify(prorektorData)}`);
    console.log(`✅ 2-Bosqich: Prorektor vizasi tasdiqlandi! Status: ${prorektorData.status}`);

    // 3. Rektor Vizasi
    console.log('\n[3/7] Universitet Rektori (RECTOR) farmoyishi va yakuniy vizasi...');
    const rektorToken = await login('rektor');
    const rektorReq = await fetch(`${API}/requests/${requestId}/workflow-advance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rektorToken}`,
      },
      body: JSON.stringify({
        status: 'APPROVED_BY_RECTOR',
        note: 'Universitet rektori xaridga rozilik berdi va buyruq imzolandi (QR-Pairing Biometrik)',
      }),
    });
    const rektorData = await rektorReq.json();
    if (!rektorReq.ok) throw new Error(`Rektor failed: ${JSON.stringify(rektorData)}`);
    console.log(`✅ 3-Bosqich: Rektor vizasi tasdiqlandi! Status: ${rektorData.status}`);

    // 4. Bosh Hisobchi Moliyalash
    console.log('\n[4/7] Bosh hisobchi (CHIEF_ACCOUNTANT) moliyaviy tasdig‘i va sub-hisob biriktirishi...');
    const accountantToken = await login('bosh_hisobchi');
    const accountantReq = await fetch(`${API}/requests/${requestId}/workflow-advance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accountantToken}`,
      },
      body: JSON.stringify({
        status: 'FINANCED_BY_ACCOUNTANT',
        fundingSource: 'BYUDJET',
        subAccountCode: '013',
        allocatedAmount: 6200000,
        note: 'Smeta bo‘yicha 013-subhisobdan 6 200 000 so‘m ajratildi (QR-Pairing Biometrik)',
      }),
    });
    const accountantData = await accountantReq.json();
    if (!accountantReq.ok) throw new Error(`Accountant failed: ${JSON.stringify(accountantData)}`);
    console.log(`✅ 4-Bosqich: Bosh hisobchi moliyalashni tasdiqladi! Status: ${accountantData.status}`);
    console.log(`   Manba: ${accountantData.fundingSource}, Sub-hisob: ${accountantData.subAccountCode}, Ajratilgan: ${Number(accountantData.allocatedAmount).toLocaleString()} so‘m`);

    // 5. Ombor Kirimi (OS-1)
    console.log('\n[5/7] Bosh omborchi (HEAD_WAREHOUSE) kirimi va OS-1 Kirim Akti...');
    const warehouseToken = await login('omborchi');
    const warehouseReq = await fetch(`${API}/requests/${requestId}/workflow-advance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${warehouseToken}`,
      },
      body: JSON.stringify({
        status: 'RECEIVED_AT_WAREHOUSE',
        note: 'Yetkazib beruvchidan tovarlar to‘liq qabul qilib olindi va OS-1 kirim akti shakllantirildi',
      }),
    });
    const warehouseData = await warehouseReq.json();
    if (!warehouseReq.ok) throw new Error(`Warehouse failed: ${JSON.stringify(warehouseData)}`);
    console.log(`✅ 5-Bosqich: Ombor kirimi amalga oshirildi! Status: ${warehouseData.status}`);

    // 6. Komendant Binoga Qabul (OS-2)
    console.log('\n[6/7] Bino Komendantiga topshirish va qabul (OS-2 Nakladnoy)...');
    const commendantToken = await login('komendant');
    const commendantReq = await fetch(`${API}/requests/${requestId}/workflow-advance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${commendantToken}`,
      },
      body: JSON.stringify({
        status: 'HANDED_TO_COMMENDANT',
        note: 'Bino komendantiga talabnoma bo‘yicha mahsulot topshirildi va qabul qilindi (OS-2)',
      }),
    });
    const commendantData = await commendantReq.json();
    if (!commendantReq.ok) throw new Error(`Commendant failed: ${JSON.stringify(commendantData)}`);
    console.log(`✅ 6-Bosqich: Komendant qabuli tasdiqlandi! Status: ${commendantData.status}`);

    // 7. Kafedra Mudiri Yakuniy Qabuli
    console.log('\n[7/7] Kafedra mudiri xonasiga yakuniy yetkazish va yopish...');
    const finalReq = await fetch(`${API}/requests/${requestId}/workflow-advance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'FULFILLED',
        note: 'Kafedra mudiri uskunani qabul qilib oldi, xonaga o‘rnatildi va xarid zanjiri muvaffaqiyatli yakunlandi',
      }),
    });
    const finalData = await finalReq.json();
    if (!finalReq.ok) throw new Error(`Final fulfill failed: ${JSON.stringify(finalData)}`);
    console.log(`✅ 7-Bosqich: Kafedra mudiri yakuniy qabul qildi! Status: ${finalData.status}`);

    // Audit logs & Document stamps check
    console.log('\n=== ZANJIR TEKSHIRUVI: AVTOMATIK MUHRLANGAN HUJJATLAR (OS-1 & OS-2) ===');
    const stampsReq = await fetch(`${API}/document-stamps?docNumber=${reqNum}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const stampsData = await stampsReq.json();
    console.log(`Muhrlangan rasmiy hujjatlar soni: ${stampsData.length} ta`);
    stampsData.forEach((s: any) => {
      console.log(` - [${s.docType}] ${s.docNumber} | Hash: ${s.integrityHash?.substring(0, 16)}... | Imzolagan: ${s.signedByName} (${s.signerRole})`);
    });

    console.log('\n🎉 PHASE L1 7-BOSQICHLI XARID ZANJIRI 100% MUVAFFAQIYATLI O‘TDI!');
  } catch (err: any) {
    console.error('Xatolik:', err.message);
    process.exit(1);
  }
}

testPurchaseChain();
