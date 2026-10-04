# Contributing to this project

Thank you for your interest in contributing! This document outlines the process for contributing to this project.

We welcome and appreciate your contributions! Whether it's a bug fix, a new feature, 
improved documentation, or a demo, your input helps improve the project for everyone.

Please feel free to comment on open issues or create a new one to share what you'd like to contribute. 
We actively review and consider all suggestions and contributions.



## Getting Started

1. **Fork the repository** to your own GitLab account
2. **Clone** your fork locally

## Workflow

1. **Create a branch** for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** and commit with clear messages:
   ```bash
   git commit -m "Feature: Add new functionality for X"
   ```

3. **Push** your changes to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Open a Merge Request** against the main branch

## Merge Request Guidelines

- Use a clear, descriptive title
- Reference any related issues with `#issue-number`
- Include what changed and why
- Update documentation as needed
- Ensure all tests pass 
  1. Install testing support:
    ```bash
    python -m venv testing
    source testing/bin/activate
    pip install -r requirements.txt
    playwright install firefox
    ```
  2. Run tests:
    ```bash
    python -m http.server 8000 &
    pytest tests/test_loading.py
    ```

## Code Standards

- Do not follow the existing code style of version 1.0.0. It is bad. Try to improve it, it is not a difficult task ;-)
- Write tests for new functionality. We only have e2e tests in version 1.0.1.
- Keep commits focused and atomic
- Document new code and significant changes

## Issue Reporting

- Check existing issues before creating a new one
- Use the issue template when available
- Include steps to reproduce for bugs
- Tag issues appropriately



## Communication Channels

We keep project communication straightforward and centralized. Here's
how to get in touch:

### Primary Channel: GitLab Issues

- **Bug Reports**: Create an issue with the `bug` label
- **Feature Requests**: Create an issue with the `enhancement` label
- **Questions**: Create an issue with the `question` label
- **Project Updates**: We post important announcements in the [project wiki](https://gitlab.com/pheras/wirexrk/-/wikis/home)
- Be respectful and inclusive






## License

By contributing, you agree that your contributions will be licensed
under the project's [LICENSE](LICENSE).
