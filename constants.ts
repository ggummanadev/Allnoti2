
import { WorkflowTemplate } from './types';

export const INITIAL_WORKFLOWS: WorkflowTemplate[] = [
  {
    id: 'wf-1',
    name: '사업계획서',
    steps: [
      { id: 's1', title: '사업 배경 분석', hoursBefore: 168 }, // 1주일 전
      { id: 's2', title: '예산 편성안 작성', hoursBefore: 120 },
      { id: 's3', title: '최종 검토 및 보고', hoursBefore: 24 }
    ]
  },
  {
    id: 'wf-2',
    name: '프로그램 운영',
    steps: [
      { id: 'p1', title: '프로그램 운영 계획서 작성', hoursBefore: 336 },
      { id: 'p2', title: '계획서 협조 공문 발송', hoursBefore: 240 },
      { id: 'p3', title: '협조 공문 발송 확인', hoursBefore: 168 },
      { id: 'p4', title: '강사 확인', hoursBefore: 120 },
      { id: 'p5', title: '참석자 명부 준비', hoursBefore: 72 },
      { id: 'p6', title: '보도자료 준비', hoursBefore: 48 },
      { id: 'p7', title: '현장 집행 카드 수령', hoursBefore: 24 },
      { id: 'p8', title: '증빙용 사진 확인', hoursBefore: 12 },
      { id: 'p9', title: '보도용 사진촬영', hoursBefore: 2 },
      { id: 'p10', title: '결과 보고서 작성', hoursBefore: 48 },
      { id: 'p11', title: '결과보고 협조 공문 작성', hoursBefore: 72 },
      { id: 'p12', title: '강사료 집행 확인', hoursBefore: 168 }
    ]
  },
  {
    id: 'wf-3',
    name: '행사 운영',
    steps: [
      { id: 'e1', title: '장소 대관 확인', hoursBefore: 720 },
      { id: 'e2', title: '초청장 발송', hoursBefore: 336 },
      { id: 'e3', title: '기념품 주문', hoursBefore: 240 }
    ]
  },
  {
    id: 'wf-4',
    name: '보고서 제출',
    steps: [
      { id: 'r1', title: '보고서 작성', hoursBefore: 72 },
      { id: 'r2', title: '보고서 사전공유', hoursBefore: 48 },
      { id: 'r3', title: '회의실 섭외', hoursBefore: 24 },
      { id: 'r4', title: '회의자료 준비', hoursBefore: 24 }
    ]
  }
];
