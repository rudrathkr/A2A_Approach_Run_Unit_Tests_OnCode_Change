import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TodoItem } from './todo.model';
import { TodoService } from './todo.service';

describe('TodoService', () => {
  let service: TodoService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TodoService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(TodoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads todo items from the API', () => {
    const expected: TodoItem[] = [
      { id: 1, title: 'Build API', description: '', status: 'START' }
    ];
    let response: TodoItem[] | undefined;

    service.getTodos().subscribe((todos) => {
      response = todos;
    });

    const request = httpMock.expectOne('/api/todos');
    expect(request.request.method).toBe('GET');
    request.flush(expected);

    expect(response).toEqual(expected);
  });

  it('creates todo items through the API', () => {
    const created: TodoItem = {
      id: 4,
      title: 'Add unit tests',
      description: 'Cover service behavior',
      status: 'START'
    };
    let response: TodoItem | undefined;

    service.createTodo({
      title: 'Add unit tests',
      description: 'Cover service behavior',
      status: 'START'
    }).subscribe((todo) => {
      response = todo;
    });

    const request = httpMock.expectOne('/api/todos');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      title: 'Add unit tests',
      description: 'Cover service behavior',
      status: 'START'
    });
    request.flush(created);

    expect(response).toEqual(created);
  });

  it('updates a todo status through the API', () => {
    const updated: TodoItem = {
      id: 8,
      title: 'Verify tests',
      description: '',
      status: 'COMPLETED'
    };
    let response: TodoItem | undefined;

    service.updateStatus(8, 'COMPLETED').subscribe((todo) => {
      response = todo;
    });

    const request = httpMock.expectOne('/api/todos/8/status');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ status: 'COMPLETED' });
    request.flush(updated);

    expect(response).toEqual(updated);
  });
});
