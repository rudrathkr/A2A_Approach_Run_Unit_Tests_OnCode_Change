package com.example.todo;

public class TodoNotFoundException extends RuntimeException {

  public TodoNotFoundException(Long id) {
    super("Todo item " + id + " was not found");
  }
}
