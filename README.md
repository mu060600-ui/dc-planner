# 데이터센터 구축 시뮬레이터 (AI KOREA Data Center Planner)

지도에서 부지와 가까운 변전소를 확인하고 용도, 규모, 서버, 냉각 방식, 전력 인입을 고르면 랙 수, 전력, 냉각 설비, 변전소와 부지 크기, 3D 배치, 개략 자재 목록을 바로 계산해 보여 주는 도구입니다.

**바로 쓰기: https://mu060600-ui.github.io/dc-planner/**

- 설치 없이 PC와 모바일 브라우저에서 실행됩니다.
- 모든 결과는 교육·상담용 개략 추정값입니다. 실제 설계, 해석, 견적을 대체하지 않습니다.
- 단위 용량과 계수는 제조사 사양이 아닌 가상 값이며, 화면의 "계산 가정 보기"에 모두 공개되어 있습니다.
- 변전소 위치는 OpenStreetMap 공개 데이터(2026-11-26 기준)입니다. 한국전력 공식 자료가 아니어서 누락이나 오류가 있을 수 있고, 변전소의 여유 용량은 알 수 없습니다. 실제 전력 공급 가능 여부는 한국전력에 확인해야 합니다.
- 토지 구분 표시는 지도에 칠해진 토지 이용 색을 읽은 참고 정보입니다. 법적 용도지역이 아니며, 실제 건축 가능 여부는 용도지역과 지자체 조례를 확인해야 합니다.
- 서버 이름·모델·크기·냉각 방식은 Supermicro 공식 홈페이지에서 2026-11-25에 확인한 내용입니다. 제품명과 상표는 각 회사의 자산입니다.
- 3D 모델과 배치는 개념 표현이며 제조사 CAD나 실제 설계가 아닙니다.

## 저작권과 출처

- 코드, 3D 모델, AI KOREA 로고: © AI KOREA Co., Ltd. All rights reserved. 무단 복제와 재배포를 금합니다.
- 지도와 변전소 위치(`data/substations.json`): © OpenStreetMap contributors, Open Database License (ODbL)
- Leaflet: BSD 2-Clause License
- Three.js (vendor/): MIT License, `vendor/THREE-LICENSE.txt` 참고
- Pretendard 글꼴: SIL Open Font License 1.1
