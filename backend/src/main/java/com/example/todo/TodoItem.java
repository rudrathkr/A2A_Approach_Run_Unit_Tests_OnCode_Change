package com.example.todo;

public record TodoItem(
    Long id,
    String title,
    String description,
    TodoStatus status
) {
}
