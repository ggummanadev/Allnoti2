
import { WorkflowTemplate, Task } from '../types';
import { db } from '../db';

export const workflowService = {
  /**
   * 모든 템플릿 가져오기
   */
  getAll(): WorkflowTemplate[] {
    return db.getWorkflows();
  },

  /**
   * 특정 ID로 템플릿 가져오기
   */
  getById(id: string): WorkflowTemplate | undefined {
    return this.getAll().find(w => w.id === id);
  },

  /**
   * 템플릿 저장 (추가 또는 수정)
   */
  save(workflow: WorkflowTemplate): void {
    const workflows = this.getAll();
    const index = workflows.findIndex(w => w.id === workflow.id);
    
    let updatedWorkflows: WorkflowTemplate[];
    if (index > -1) {
      // 수정
      updatedWorkflows = workflows.map(w => w.id === workflow.id ? workflow : w);
    } else {
      // 신규 등록
      updatedWorkflows = [...workflows, workflow];
    }
    
    db.saveWorkflows(updatedWorkflows);
  },

  /**
   * 템플릿 삭제
   * @param id 삭제할 템플릿 ID
   * @param currentTasks 현재 등록된 업무 리스트 (사용 여부 체크용)
   * @returns { success: boolean, message?: string }
   */
  delete(id: string, currentTasks: Task[]): { success: boolean, message?: string } {
    const workflow = this.getById(id);
    if (!workflow) {
      return { success: false, message: "삭제하려는 템플릿을 찾을 수 없습니다." };
    }

    // 현재 업무에서 이 템플릿의 이름을 참조하고 있는지 확인
    const inUse = currentTasks.some(t => t.workflowId === workflow.name);
    if (inUse) {
      return { 
        success: false, 
        message: `삭제할 수 없습니다.\n\n이유: 현재 '${workflow.name}' 템플릿이 하나 이상의 업무에 등록되어 사용 중입니다.\n\n해당 업무를 먼저 삭제하거나 템플릿 연결을 해제한 후 다시 시도해 주세요.` 
      };
    }

    const workflows = this.getAll();
    const filtered = workflows.filter(w => w.id !== id);
    db.saveWorkflows(filtered);
    
    return { success: true };
  }
};
