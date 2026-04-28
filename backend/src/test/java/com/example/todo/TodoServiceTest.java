package com.example.todo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class TodoServiceTest {

  private final TodoService todoService = new TodoService();

  @Test
  void createsTodoWithStartStatusWhenStatusIsMissing() {
    TodoItem created = todoService.create(new TodoCreateRequest(
        "  Write frontend tests  ",
        null,
        null
    ));

    assertThat(created.id()).isEqualTo(1L);
    assertThat(created.title()).isEqualTo("Write frontend tests");
    assertThat(created.description()).isEmpty();
    assertThat(created.status()).isEqualTo(TodoStatus.START);
  }

  @Test
  void updatesStatusForExistingTodo() {
    TodoItem created = todoService.create(new TodoCreateRequest(
        "Connect API",
        "Use HttpClient",
        TodoStatus.START
    ));

    TodoItem updated = todoService.updateStatus(created.id(), TodoStatus.IN_PROGRESS);

    assertThat(updated.status()).isEqualTo(TodoStatus.IN_PROGRESS);
    assertThat(todoService.findAll()).containsExactly(updated);
  }

  @Test
  void throwsWhenDeletingMissingTodo() {
    assertThatThrownBy(() -> todoService.delete(99L))
        .isInstanceOf(TodoNotFoundException.class)
        .hasMessageContaining("99");
  }
}
