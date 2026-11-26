// 데이터센터 개략 구성 계산. 화면과 분리된 순수 계산이라 node 로 검산할 수 있다(tools/test_calc.mjs).
// 모든 결과는 교육·상담용 개략 추정값이다. 실제 설계, 해석, 견적을 대체하지 않는다.
// 아래 "가정"의 단위 용량·계수는 제조사 사양이 아니라 계산을 위한 가상 값이다. 화면에 그대로 공개한다.

export const WORKLOADS = {
  biz: { name: '일반 업무 · 웹', desc: '사내 시스템, 홈페이지, 파일 저장', density: 8, server: 'smc-1u', cooling: 'air', it: 200 },
  cloud: { name: '클라우드 · 가상화', desc: '여러 서비스를 한곳에서 운영', density: 15, server: 'smc-2u-hyper', cooling: 'air', it: 2000 },
  inf: { name: 'AI 추론', desc: '학습이 끝난 AI를 서비스에 사용', density: 40, server: 'smc-gpu-air', cooling: 'inrow', it: 5000 },
  train: { name: '대규모 AI 학습', desc: 'GPU 수천 개로 AI 모델 학습', density: 130, server: 'smc-gb300', cooling: 'dlc', it: 30000 },
};

// 서버: 이름·크기·냉각 방식은 Supermicro 공식 페이지 확인값(2026-11-25). 소비전력은 싣지 않는다.
export const SERVERS = {
  'smc-1u': { name: 'Supermicro 1U 랙마운트 서버', model: 'SYS-122C-TN', size: '1U', cool: 'air', variant: 'cpu1u', fit: ['biz', 'cloud'], note: '가장 얇은 범용 서버', url: 'https://www.supermicro.com/en/products/system/clouddc/1u/sys-122c-tn' },
  'smc-2u-hyper': { name: 'Supermicro 2U Hyper 서버', model: 'SYS-212H-TN', size: '2U', cool: 'air', variant: 'cpu2u', fit: ['biz', 'cloud', 'inf'], note: '확장성이 좋은 2U 서버', url: 'https://www.supermicro.com/en/products/system/hyper/2u/sys-212h-tn' },
  'smc-storage': { name: 'Supermicro 스토리지 서버', model: 'SSG-221E-DN2R24R', size: '2U', cool: 'air', variant: 'storage', fit: ['biz', 'cloud'], note: '데이터 보관 전용', url: 'https://www.supermicro.com/en/products/system/storage/2u/ssg-221e-dn2r24r' },
  'smc-gpu-air': { name: 'Supermicro 공랭식 GPU 서버', model: 'SYS-822GS-NB3RT', size: '8U', cool: 'air', variant: 'gpu', fit: ['inf', 'train'], note: 'GPU 8개, 팬으로 냉각', url: 'https://www.supermicro.com/en/products/system/gpu/8u/sys-822gs-nb3rt' },
  'smc-hgx-b300': { name: 'Supermicro HGX B300 8-GPU 서버 (액체냉각)', model: 'SYS-422GS-NB3RT-ALC', size: '4U', cool: 'liquid', variant: 'hgx', fit: ['inf', 'train'], note: 'GPU 8개, 냉각수로 직접 냉각', url: 'https://www.supermicro.com/en/products/system/gpu/4u/sys-422gs-nb3rt-alc' },
  'smc-gb300': { name: 'Supermicro GB300 NVL72', model: 'SRS-GB300-NVL72', size: '48U 랙', cool: 'liquid', variant: 'nvl72', fit: ['train'], note: '랙 한 대에 GPU 72개, 액체냉각 필수', url: 'https://www.supermicro.com/en/products/rack/srs-gb300-nvl72' },
};

export const COOLING = {
  air: { name: '공랭', desc: 'CRAH·FWU가 찬 공기를 불어 식힘' },
  inrow: { name: '고밀도 공랭', desc: '랙 사이 In-row 냉방기로 가까이에서 식힘' },
  dlc: { name: '액체냉각', desc: '칩에 냉각수를 직접 보냄 (DLC + CDU)' },
};
export const REJECT = {
  chiller: { name: 'Chiller 중심', desc: '냉동기로 차가운 물을 만듦' },
  dry: { name: 'Dry Cooler 중심', desc: '바깥 공기로만 식힘, 물 사용 적음' },
  mix: { name: 'Dry Cooler + Chiller 보조', desc: '평소는 바깥 공기, 더울 때 냉동기' },
};
// 수전 전압. 기준 용량은 국내에서 일반적으로 쓰이는 구분을 단순화한 것이며, 실제 수전 방식은 한전과 협의해 정한다.
export const VOLTAGE = {
  auto: { name: '규모에 맞춰 자동', desc: '전체 시설 전력에 맞는 전압을 고름' },
  '22.9': { name: '22.9kV', desc: '약 10MW 이하. 가까운 배전선로에서 받음' },
  '154': { name: '154kV', desc: '약 10~400MW. 부지 안에 변전소 필요' },
  '345': { name: '345kV', desc: '약 400MW 이상. 대형 변전소 필요' },
};
export const EXPANSION = { 1: { name: '여유 없음', desc: '지금 규모만' }, 1.5: { name: '1.5배 부지', desc: '추후 증설 대비' }, 2: { name: '2배 부지', desc: '2단계 건설 대비' } };

export const REDUNDANCY = { N: { name: '예비 없음 (N)' }, 'N+1': { name: '예비 1대 (N+1)' }, '2N': { name: '완전 이중화 (2N)' } };

// 가정 (가상 값). 화면의 "계산 가정" 표에 그대로 표시한다.
export const A = {
  liquidCapture: 0.8,      // 액체냉각이 냉각수로 가져가는 열의 비율
  airLimit: 25,            // 일반 공랭으로 감당하기 쉬운 랙당 kW
  inrowLimit: 50,          // 고밀도 공랭(In-row)의 랙당 kW
  crahKw: 150, fwuKw: 400, inrowKw: 40,
  cduRackKw: 250, cduRowKw: 1300,
  chillerSmallKw: 500, chillerKw: 1500, dryKw: 1000,
  upsSmallKw: 250, upsKw: 1000, genKw: 2500,
  rackArea: 2.6, supportRatio: 0.35,
  deltaT: 10,              // 냉각수 공급·환수 온도 차 (K)
  otherLoss: 0.08,         // 전력 변환 손실, 조명 등
  powerFactor: 0.95, rxMargin: 0.1,           // 역률, 수전 용량 여유
  trKva: { '22.9': 2500, '154': 60000, '345': 250000 },   // 주변압기 1대 용량 (kVA)
  subBase: { '22.9': 40, '154': 1200, '345': 5000 }, subPerTr: { '22.9': 25, '154': 400, '345': 1500 },   // 변전소 면적 = 기본 + 변압기 1대당 (㎡)
  bldgRatio: 1.6,          // 서버실 면적 대비 건물 바닥 면적 (기계·전력실, 복도 포함)
  yardPerCooler: 45, yardPerGen: 50,          // 옥외 설비 1대가 차지하는 면적 (㎡)
  siteRatio: 1.8,          // 건물·설비 면적 대비 부지 (도로, 주차, 이격거리, 녹지)
};
export const ASSUMPTIONS = [
  ['액체냉각이 냉각수로 가져가는 열', '80%', '나머지 20%는 공기로 식힘(잔여 공랭 부하)'],
  ['일반 공랭 권장 한계', '랙당 25kW', '넘으면 고밀도 공랭이나 액체냉각 검토'],
  ['고밀도 공랭(In-row) 권장 한계', '랙당 50kW', ''],
  ['공조기 1대 용량', 'CRAH 150kW / FWU 400kW / In-row 40kW', 'IT 2MW 이상은 FWU로 계산'],
  ['CDU 1대 용량', '랙 내장형 250kW / 열 단위 1,300kW', '액체 열량 1MW 이하는 랙 내장형으로 계산'],
  ['열 배출 설비 1대 용량', 'Chiller 500kW·1,500kW / Dry Cooler 1,000kW', ''],
  ['UPS 1대 용량', '250kW (1MW 미만) / 1,000kW', ''],
  ['비상발전기 1대 용량', '2,500kW', 'IT 500kW 이상일 때 계산'],
  ['랙 1대가 차지하는 면적', '2.6㎡ + 지원 공간 35%', '통로 포함'],
  ['냉각수 온도 차(ΔT)', '10K', '유량 = 열량 ÷ (4.18 × ΔT)'],
  ['전력 손실·조명 등', 'IT 전력의 8%', 'PUE 예시 계산용'],
  ['수전 용량', '전체 시설 전력 ÷ 역률 0.95 × 여유 1.1', '단위 MVA'],
  ['수전 전압 구분', '10MW 이하 22.9kV / 400MW 이하 154kV / 그 이상 345kV', '단순화한 구분. 실제는 한전 협의로 결정'],
  ['주변압기 1대 용량', '22.9kV 2.5MVA / 154kV 60MVA / 345kV 250MVA', ''],
  ['변전소(수전설비) 면적', '22.9kV 40+25㎡ / 154kV 1,200+400㎡ / 345kV 5,000+1,500㎡', '기본 면적 + 변압기 1대당 면적. 옥내 GIS 기준의 개략값'],
  ['건물 바닥 면적', '서버실 면적 × 1.6', '기계실, 전력실, 복도 포함. 단층 가정'],
  ['옥외 설비 면적', '냉각 설비 1대 45㎡ / 발전기 1대 50㎡', ''],
  ['부지 면적', '(건물 + 옥외 설비 + 변전소) × 1.8 × 증설 여유', '도로, 주차, 이격거리, 녹지 포함'],
];

const ceil = Math.ceil;
function withRedundancy(n, r) { if (n <= 0) return 0; return r === '2N' ? n * 2 : r === 'N+1' ? n + 1 : n; }

/** input: { workload, itKw, density, server, cooling, reject, redundancy } */
export function plan(input) {
  const { itKw, density, cooling, reject, redundancy } = input;
  const server = SERVERS[input.server];
  const racks = ceil(itKw / density);
  const liquid = cooling === 'dlc';
  const liqKw = liquid ? itKw * A.liquidCapture : 0;
  const airKw = itKw - liqKw;

  // 공기 쪽 냉각 장비
  let airType, airCap;
  if (cooling === 'inrow') { airType = 'In-row 냉방기'; airCap = A.inrowKw; }
  else if (itKw >= 2000) { airType = 'FWU (팬 월 유닛)'; airCap = A.fwuKw; }
  else { airType = 'CRAH (냉수식 공조기)'; airCap = A.crahKw; }
  const airBase = ceil(airKw / airCap), airUnits = withRedundancy(airBase, redundancy);

  // 액체 쪽: CDU, 매니폴드, 유량
  let cduType = null, cduBase = 0, cduUnits = 0, flowLpm = 0;
  if (liquid) {
    const row = liqKw > 1000; cduType = row ? 'In-Row CDU' : 'In-Rack CDU';
    cduBase = ceil(liqKw / (row ? A.cduRowKw : A.cduRackKw)); cduUnits = withRedundancy(cduBase, redundancy);
    flowLpm = liqKw / (4.18 * A.deltaT) * 60;
  }

  // PUE 예시
  let airF = cooling === 'inrow' ? 0.24 : 0.28 + Math.max(0, Math.min(density, A.airLimit) - 15) * 0.006;
  if (liquid) airF = 0.30;
  const liqF = reject === 'chiller' ? 0.09 : 0.05;
  if (!liquid && reject !== 'chiller') airF -= 0.02;
  const coolKw = airKw * airF + liqKw * liqF, otherKw = itKw * A.otherLoss;
  const facilityKw = itKw + coolKw + otherKw, pue = facilityKw / itKw;

  // 열 배출 설비
  const heatKw = itKw + otherKw * 0.5;
  const chCap = itKw < 1000 ? A.chillerSmallKw : A.chillerKw;
  let chillers = 0, dry = 0;
  if (reject === 'chiller') chillers = withRedundancy(ceil(heatKw / chCap), redundancy);
  else if (reject === 'dry') dry = withRedundancy(ceil(heatKw / A.dryKw), redundancy);
  else { dry = withRedundancy(ceil((liquid ? liqKw : heatKw * 0.6) / A.dryKw), redundancy); chillers = withRedundancy(ceil((liquid ? airKw : heatKw * 0.4) / chCap), redundancy); }
  const pumps = withRedundancy(Math.max(1, ceil(heatKw / 3000)), redundancy === 'N' ? 'N' : 'N+1');

  // 전력 설비
  const upsCap = itKw < 1000 ? A.upsSmallKw : A.upsKw;
  const ups = withRedundancy(ceil(itKw / upsCap), redundancy);
  const gens = itKw >= 500 ? withRedundancy(ceil(facilityKw / A.genKw), redundancy === 'N' ? 'N' : 'N+1') : 0;

  const area = racks * A.rackArea * (1 + A.supportRatio);

  // 수전(전기를 받는 설비)과 부지
  const recVoltage = facilityKw <= 10000 ? '22.9' : facilityKw <= 400000 ? '154' : '345';
  const voltage = !input.voltage || input.voltage === 'auto' ? recVoltage : String(input.voltage);
  const mva = facilityKw / A.powerFactor * (1 + A.rxMargin) / 1000;
  const trBase = ceil(mva * 1000 / A.trKva[voltage]);
  const transformers = redundancy === '2N' ? trBase * 2 : redundancy === 'N' ? trBase : trBase + 1;
  const expansion = Number(input.expansion || 1);
  const bldgArea = area * A.bldgRatio;
  const yardArea = (chillers + dry) * A.yardPerCooler + gens * A.yardPerGen;
  const subArea = A.subBase[voltage] + A.subPerTr[voltage] * transformers;
  const siteArea = (bldgArea + yardArea + subArea) * A.siteRatio * expansion;
  const buildings = Math.max(1, ceil(itKw / 40000));

  // 적합성 점검
  const checks = [];
  const add = (level, text) => checks.push({ level, text });
  if (cooling === 'air' && density > A.inrowLimit) add('bad', `랙당 ${density}kW는 공기만으로 식힐 수 없습니다. 액체냉각이 필요합니다.`);
  else if (cooling === 'air' && density > A.airLimit) add('bad', `랙당 ${density}kW는 일반 공랭으로는 벅찹니다. 고밀도 공랭(In-row)이나 액체냉각을 고르세요.`);
  if (cooling === 'inrow' && density > A.inrowLimit) add('bad', `랙당 ${density}kW는 고밀도 공랭의 한계를 넘습니다. 액체냉각이 필요합니다.`);
  if (server.cool === 'liquid' && !liquid) add('bad', `${server.name}는 액체냉각 전용입니다. 냉각 방식을 액체냉각으로 바꾸세요.`);
  if (server.variant === 'nvl72' && density < 100) add('warn', 'GB300 NVL72는 랙 한 대에 GPU 72개가 들어가는 고밀도 제품입니다. 랙당 전력 밀도를 100kW 이상으로 두는 편이 실제에 가깝습니다.');
  if (liquid && server.cool === 'air') add('warn', '고른 서버는 공랭식 모델입니다. 액체냉각을 쓰려면 액체냉각 전용 서버가 필요합니다.');
  if (liquid && density <= 15) add('warn', '이 밀도에서는 공랭식이 더 단순하고 경제적입니다. 배관 공사와 누설 관리 부담을 감안하세요.');
  if (liquid && reject === 'chiller') add('info', '액체냉각은 비교적 따뜻한 물로도 식힐 수 있어 Dry Cooler를 쓰면 냉각 전력을 더 줄일 수 있습니다.');
  if (!liquid && reject === 'dry') add('warn', '공랭식은 더 차가운 물이 필요해, 더운 날에는 Dry Cooler만으로 부족할 수 있습니다. Chiller 보조를 검토하세요.');
  if (redundancy === 'N') add('warn', '예비 설비가 없으면 장비 한 대만 고장 나도 서비스가 멈출 수 있습니다.');
  const order = ['22.9', '154', '345'];
  if (order.indexOf(voltage) < order.indexOf(recVoltage)) add('bad', `전체 시설 전력 ${powerLabel(Math.round(facilityKw))}는 ${voltage}kV로 받기에 너무 큽니다. ${recVoltage}kV 수전과 부지 내 변전소가 필요합니다.`);
  else if (order.indexOf(voltage) > order.indexOf(recVoltage)) add('info', `이 규모는 ${recVoltage}kV로도 받을 수 있습니다. ${voltage}kV는 변전소가 커지고 비용이 늘어납니다.`);
  if (voltage !== '22.9') add('info', `${voltage}kV 수전은 송전선로 인입과 변전소 건설에 시간이 오래 걸립니다. 부지를 정하기 전에 한전과 전력 공급 가능 여부부터 확인해야 합니다.`);
  if (!server.fit.includes(input.workload)) add('info', '고른 서버는 이 용도에 흔히 쓰는 조합이 아닙니다. 가능은 하지만 다시 확인해 보세요.');
  if (!checks.some((c) => c.level === 'bad') && !checks.some((c) => c.level === 'warn')) add('ok', '선택한 구성은 서로 잘 맞습니다.');
  const feasible = !checks.some((c) => c.level === 'bad');

  // 개략 자재 목록 (수량만. 가격은 싣지 않는다)
  const bom = [];
  const row = (cat, item, qty, unit, note) => { if (qty > 0) bom.push({ cat, item, qty, unit, note }); };
  row('서버·랙', '서버 랙', racks, '대', `랙당 ${density}kW`);
  bom[bom.length] = { cat: '서버·랙', item: server.name, qty: '상세 설계', unit: '', note: `대표 모델 ${server.model}, 크기 ${server.size}. 수량은 상세 설계에서 확정` };
  row('공랭 설비', airType, airUnits, '대', `${airCap}kW급, 필요 ${airBase}대 + 예비`);
  if (liquid) {
    row('액체냉각', cduType, cduUnits, '대', `${(cduType === 'In-Row CDU' ? A.cduRowKw : A.cduRackKw).toLocaleString()}kW급, 필요 ${cduBase}대 + 예비`);
    row('액체냉각', '랙 매니폴드 (공급·환수 1조)', racks, '조', '랙마다 1조');
    row('액체냉각', '2차 측 냉각수 배관', 1, '식', `유량 약 ${Math.round(flowLpm).toLocaleString()} L/min (ΔT ${A.deltaT}K)`);
  }
  row('열 배출', 'Chiller (냉동기)', chillers, '대', `${chCap.toLocaleString()}kW급`);
  row('열 배출', 'Dry Cooler (건식 냉각기)', dry, '대', `${A.dryKw.toLocaleString()}kW급`);
  row('열 배출', '순환 펌프', pumps, '대', '');
  row('열 배출', '1차 측 냉각수 배관', 1, '식', '설비와 서버실 사이');
  row('수전·변전', voltage === '22.9' ? '수전용 변압기' : `주변압기 (${voltage}kV)`, transformers, '대', `${(A.trKva[voltage] / 1000).toLocaleString()}MVA급, 필요 ${trBase}대 + 예비`);
  row('수전·변전', voltage === '22.9' ? '특고압 수배전반' : `${voltage}kV GIS (가스절연개폐장치)`, 1, '식', voltage === '22.9' ? '' : '옥내형 가정');
  row('수전·변전', voltage === '22.9' ? '배전선로 인입' : '송전선로 인입', 1, '식', `수전 용량 약 ${mva.toFixed(mva < 10 ? 1 : 0)}MVA. 한전 협의 대상`);
  row('전력', 'UPS', ups, '대', `${upsCap.toLocaleString()}kW급`);
  row('전력', '비상발전기', gens, '대', `${A.genKw.toLocaleString()}kW급`);
  row('전력', '배전반 · PDU', 1, '식', '');

  return { racks, liqKw, airKw, airType, airCap, airBase, airUnits, cduType, cduBase, cduUnits, flowLpm, coolKw, otherKw, facilityKw, pue, heatKw, chillers, dry, pumps, ups, gens, area, voltage, recVoltage, mva, trBase, transformers, expansion, bldgArea, yardArea, subArea, siteArea, buildings, checks, feasible, bom: bom.filter((b) => b.qty !== null), server, liquid };
}

export function fmt(v, d = 0) { return Number(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }); }
export function powerLabel(kw) { return kw >= 1000 ? `${fmt(kw / 1000, kw % 1000 ? 1 : 0)} MW` : `${fmt(kw)} kW`; }
