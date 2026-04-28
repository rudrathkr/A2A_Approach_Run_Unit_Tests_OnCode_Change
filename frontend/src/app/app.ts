import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TodoItem, TodoStatus } from './todo.model';
import { TodoService } from './todo.service';

interface BoardColumn {
  status: TodoStatus;
  title: string;
  accent: string;
}

const BOARD_COLUMNS: BoardColumn[] = [
  { status: 'START', title: 'Start', accent: 'start' },
  { status: 'IN_PROGRESS', title: 'In progress', accent: 'progress' },
  { status: 'COMPLETED', title: 'Completed', accent: 'complete' }
];

@Component({
  selector: 'app-root',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private readonly todoService = inject(TodoService);

  readonly columns = BOARD_COLUMNS;
  readonly todos = signal<TodoItem[]>([]);
  readonly errorMessage = signal('');
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly todoForm = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)]
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(240)]
    })
  });

  ngOnInit(): void {
    this.loadTodos();
  }

  loadTodos(): void {
    this.isLoading.set(true);
    this.todoService.getTodos().subscribe({
      next: (todos) => {
        this.todos.set(todos);
        this.errorMessage.set('');
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load tasks.');
        this.isLoading.set(false);
      }
    });
  }

  createTodo(): void {
    if (this.todoForm.invalid || this.isSaving()) {
      this.todoForm.markAllAsTouched();
      return;
    }

    const formValue = this.todoForm.getRawValue();
    this.isSaving.set(true);
    this.todoService.createTodo({
      title: formValue.title.trim(),
      description: formValue.description.trim(),
      status: 'START'
    }).subscribe({
      next: (created) => {
        this.todos.update((todos) => [...todos, created]);
        this.todoForm.reset();
        this.errorMessage.set('');
        this.isSaving.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to add task.');
        this.isSaving.set(false);
      }
    });
  }

  changeStatus(todo: TodoItem, status: TodoStatus): void {
    if (todo.status === status) {
      return;
    }

    this.todoService.updateStatus(todo.id, status).subscribe({
      next: (updated) => {
        this.todos.update((todos) => todos.map((item) => (
          item.id === updated.id ? updated : item
        )));
        this.errorMessage.set('');
      },
      error: () => this.errorMessage.set('Unable to update task.')
    });
  }

  deleteTodo(todo: TodoItem): void {
    this.todoService.deleteTodo(todo.id).subscribe({
      next: () => {
        this.todos.update((todos) => todos.filter((item) => item.id !== todo.id));
        this.errorMessage.set('');
      },
      error: () => this.errorMessage.set('Unable to remove task.')
    });
  }

  todosByStatus(status: TodoStatus): TodoItem[] {
    return this.todos().filter((todo) => todo.status === status);
  }

  trackByTodoId(_: number, todo: TodoItem): number {
    return todo.id;
  }
}
