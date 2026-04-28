package com.example.todo;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(TodoController.class)
class TodoControllerTest {

  @Autowired
  private MockMvc mockMvc;

  @MockitoBean
  private TodoService todoService;

  @Test
  void returnsTodoItems() throws Exception {
    when(todoService.findAll()).thenReturn(List.of(
        new TodoItem(1L, "Draft API", "Create contract", TodoStatus.START),
        new TodoItem(2L, "Build UI", "Kanban board", TodoStatus.IN_PROGRESS)
    ));

    mockMvc.perform(get("/api/todos"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].title").value("Draft API"))
        .andExpect(jsonPath("$[0].status").value("START"))
        .andExpect(jsonPath("$[1].status").value("IN_PROGRESS"));
  }

  @Test
  void createsTodoItem() throws Exception {
    when(todoService.create(any(TodoCreateRequest.class)))
        .thenReturn(new TodoItem(7L, "Add tests", "", TodoStatus.START));

    mockMvc.perform(post("/api/todos")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "title": "Add tests",
                  "description": ""
                }
                """))
        .andExpect(status().isCreated())
        .andExpect(header().string(HttpHeaders.LOCATION, "/api/todos/7"))
        .andExpect(jsonPath("$.id").value(7))
        .andExpect(jsonPath("$.status").value("START"));
  }

  @Test
  void rejectsTodoWithoutTitle() throws Exception {
    mockMvc.perform(post("/api/todos")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "title": " ",
                  "description": "Missing title"
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Title is required"));
  }

  @Test
  void updatesTodoStatus() throws Exception {
    when(todoService.updateStatus(eq(3L), eq(TodoStatus.COMPLETED)))
        .thenReturn(new TodoItem(3L, "Run tests", "", TodoStatus.COMPLETED));

    mockMvc.perform(patch("/api/todos/3/status")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "status": "COMPLETED"
                }
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("COMPLETED"));
  }

  @Test
  void returnsNotFoundForMissingTodo() throws Exception {
    doThrow(new TodoNotFoundException(42L)).when(todoService).delete(42L);

    mockMvc.perform(delete("/api/todos/42"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.message").value("Todo item 42 was not found"));

    verify(todoService).delete(42L);
  }
}
