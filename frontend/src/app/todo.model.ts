export type TodoStatus = 'START' | 'IN_PROGRESS' | 'COMPLETED';

export interface TodoItem {
  id: number;
  title: string;
  description: string;
  status: TodoStatus;
}

export interface CreateTodoRequest {
  title: string;
  description: string;
  status?: TodoStatus;
}
