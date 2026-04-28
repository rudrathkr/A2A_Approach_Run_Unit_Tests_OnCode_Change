import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CreateTodoRequest, TodoItem, TodoStatus } from './todo.model';

@Injectable({
  providedIn: 'root'
})
export class TodoService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/todos';

  getTodos(): Observable<TodoItem[]> {
    return this.http.get<TodoItem[]>(this.apiUrl);
  }

  createTodo(request: CreateTodoRequest): Observable<TodoItem> {
    return this.http.post<TodoItem>(this.apiUrl, request);
  }

  updateStatus(id: number, status: TodoStatus): Observable<TodoItem> {
    return this.http.patch<TodoItem>(`${this.apiUrl}/${id}/status`, { status });
  }

  deleteTodo(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
