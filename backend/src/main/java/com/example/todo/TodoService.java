package com.example.todo;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Service;

@Service
public class TodoService {

  private final Map<Long, TodoItem> todoItems = new ConcurrentHashMap<>();
  private final AtomicLong sequence = new AtomicLong();

  public List<TodoItem> findAll() {
    return todoItems.values().stream()
        .sorted(Comparator.comparing(TodoItem::id))
        .toList();
  }

  public TodoItem create(TodoCreateRequest request) {
    Long id = sequence.incrementAndGet();
    TodoStatus status = request.status() == null ? TodoStatus.START : request.status();
    TodoItem todoItem = new TodoItem(
        id,
        request.title().trim(),
        normalizeDescription(request.description()),
        status
    );

    todoItems.put(id, todoItem);
    return todoItem;
  }

  public TodoItem updateStatus(Long id, TodoStatus status) {
    TodoItem existing = getRequired(id);
    TodoItem updated = new TodoItem(
        existing.id(),
        existing.title(),
        existing.description(),
        status
    );

    todoItems.put(id, updated);
    return updated;
  }

  public void delete(Long id) {
    TodoItem removed = todoItems.remove(id);
    if (removed == null) {
      throw new TodoNotFoundException(id);
    }
  }

  private TodoItem getRequired(Long id) {
    TodoItem todoItem = todoItems.get(id);
    if (todoItem == null) {
      throw new TodoNotFoundException(id);
    }

    return todoItem;
  }

  private String normalizeDescription(String description) {
    return description == null ? "" : description.trim();
  }
}
