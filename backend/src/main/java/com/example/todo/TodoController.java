package com.example.todo;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/todos")
@CrossOrigin(origins = "http://localhost:4200")
public class TodoController {

  private final TodoService todoService;

  public TodoController(TodoService todoService) {
    this.todoService = todoService;
  }

  @GetMapping
  public List<TodoItem> findAll() {
    return todoService.findAll();
  }

  @PostMapping
  public ResponseEntity<TodoItem> create(@Valid @RequestBody TodoCreateRequest request) {
    TodoItem created = todoService.create(request);
    return ResponseEntity
        .created(URI.create("/api/todos/" + created.id()))
        .body(created);
  }

  @PatchMapping("/{id}/status")
  public TodoItem updateStatus(
      @PathVariable Long id,
      @Valid @RequestBody TodoStatusUpdateRequest request
  ) {
    return todoService.updateStatus(id, request.status());
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable Long id) {
    todoService.delete(id);
    return ResponseEntity.noContent().build();
  }
}
