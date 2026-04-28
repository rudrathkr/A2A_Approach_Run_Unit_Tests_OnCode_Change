package com.example.todo;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler(TodoNotFoundException.class)
  ResponseEntity<Map<String, String>> handleNotFound(TodoNotFoundException exception) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(Map.of("message", exception.getMessage()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException exception) {
    String message = exception.getBindingResult()
        .getFieldErrors()
        .stream()
        .findFirst()
        .map(fieldError -> fieldError.getDefaultMessage())
        .orElse("Request is invalid");

    return ResponseEntity.badRequest().body(Map.of("message", message));
  }
}
