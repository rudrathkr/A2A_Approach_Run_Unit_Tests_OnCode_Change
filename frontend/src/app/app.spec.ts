import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import { TodoItem, TodoStatus } from './todo.model';
import { TodoService } from './todo.service';

describe('App', () => {
  const seedTodos: TodoItem[] = [
    {
      id: 1,
      title: 'Draft API contract',
      description: 'Agree on the REST shape',
      status: 'START'
    },
    {
      id: 2,
      title: 'Build board',
      description: 'Render by status',
      status: 'IN_PROGRESS'
    }
  ];

  let todoService: {
    getTodos: ReturnType<typeof vi.fn>;
    createTodo: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    deleteTodo: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    todoService = {
      getTodos: vi.fn(() => of(seedTodos)),
      createTodo: vi.fn((request: { title: string; description: string; status: TodoStatus }) => of({
        id: 3,
        ...request
      })),
      updateStatus: vi.fn((id: number, status: TodoStatus) => of({
        ...seedTodos.find((todo) => todo.id === id)!,
        status
      })),
      deleteTodo: vi.fn(() => of(undefined))
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: TodoService, useValue: todoService }
      ]
    }).compileComponents();
  });

  it('renders the Kanban columns and loaded tasks', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(todoService.getTodos).toHaveBeenCalledOnce();
    expect(compiled.textContent).toContain('Start');
    expect(compiled.textContent).toContain('In progress');
    expect(compiled.textContent).toContain('Completed');
    expect(compiled.textContent).toContain('Draft API contract');
    expect(compiled.textContent).toContain('Build board');
  });

  it('creates a task through the API service', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const titleInput = compiled.querySelector<HTMLInputElement>('input[name="title"]')!;
    const descriptionInput = compiled.querySelector<HTMLInputElement>('input[name="description"]')!;
    const form = compiled.querySelector<HTMLFormElement>('form')!;

    titleInput.value = 'Run unit tests';
    titleInput.dispatchEvent(new Event('input'));
    descriptionInput.value = 'Frontend and backend';
    descriptionInput.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(todoService.createTodo).toHaveBeenCalledWith({
      title: 'Run unit tests',
      description: 'Frontend and backend',
      status: 'START'
    });
    expect(compiled.textContent).toContain('Run unit tests');
  });

  it('updates task status through the API service', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.changeStatus(seedTodos[0], 'COMPLETED');

    expect(todoService.updateStatus).toHaveBeenCalledWith(1, 'COMPLETED');
    expect(component.todos().find((todo) => todo.id === 1)?.status).toBe('COMPLETED');
  });
});
