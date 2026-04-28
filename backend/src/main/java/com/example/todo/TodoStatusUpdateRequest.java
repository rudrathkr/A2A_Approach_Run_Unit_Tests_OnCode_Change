package com.example.todo;

import jakarta.validation.constraints.NotNull;

public record TodoStatusUpdateRequest(
    @NotNull(message = "Status is required")
    TodoStatus status
) {
}
