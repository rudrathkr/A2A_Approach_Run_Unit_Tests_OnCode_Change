package com.example.todo;

public enum TodoStatus {
  START("Start"),
  IN_PROGRESS("In progress"),
  COMPLETED("Completed");

  private final String label;

  TodoStatus(String label) {
    this.label = label;
  }

  public String getLabel() {
    return label;
  }
}
