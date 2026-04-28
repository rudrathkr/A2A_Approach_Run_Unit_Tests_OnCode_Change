package com.example.todo;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DemoDataConfig {

  @Bean
  ApplicationRunner seedTodos(TodoService todoService) {
    return args -> {
      if (!todoService.findAll().isEmpty()) {
        return;
      }

      todoService.create(new TodoCreateRequest(
          "Draft API contract",
          "Confirm the todo endpoint shape used by the Angular app.",
          TodoStatus.START
      ));
      todoService.create(new TodoCreateRequest(
          "Build Kanban board",
          "Group work by status and keep updates API-backed.",
          TodoStatus.IN_PROGRESS
      ));
      todoService.create(new TodoCreateRequest(
          "Write test plan",
          "Cover frontend rendering and backend REST behavior.",
          TodoStatus.COMPLETED
      ));
    };
  }
}
