---
applyTo: "*"
---

# Project Overview

This is a django frontend for GregoryAi, it is designed to help doctors, researchers, and patients find relevant scientific articles and clinical trials related to multiple sclerosis (MS) and other neurological diseases. The project aims to provide a comprehensive platform for accessing and organizing scientific literature and clinical trial data.

It needs to be easy to use and understand by anyone, regardless of their background.

Main features:
- Allow users to search for scientific articles and clinical trials.
- Allow users to subscribe to newsletters with current relevant articles and trials.
- Provide an observatory page that lets users track specific topics, treatments, and therapies for brain regeneration.

Project details are available in the `communication` folder.

## Comunication guidelines for the project

Branding, messaging, and tone of voice should be consistent across all platforms and materials. Use clear, concise language that is accessible to a broad audience.



## Folder Structure

- `/django`: Contains the Django backend code. We will not be using this code. It is only here for reference.
- `files_repo_PBL_nsbe`: Contains documentation and examples for the machine learning models used in the project.
- `/docs`: Contains documentation for the project, including API specifications and user guides.

## Libraries and Frameworks

The website is built using the Hugo Static Site generator. https://gohugo.io/

We use small react apps for key areas which get their content from the API.


## Coding Standards

- use tabs for indentation
- reuse existing code and components where possible

## Testing

We can test the frontend using the `h` command which is a function for `hugo server -F -O -N -D`. When running `h` we can put it in the background to use further on.

## UI guidelines

- Application should have a modern and clean design.

### Foundational Principles

- Simplicity Through Reduction: Identify the essential purpose and eliminate everything that distracts from it. Begin with complexity, then deliberately remove until reaching the simplest effective solution.
- Material Honesty: Digital materials have unique properties. Buttons should feel pressable, cards should feel substantial, and animations should reflect real-world physics while embracing digital possibilities.
- Obsessive Detail: Consider every pixel, every interaction, and every transition. Excellence emerges from hundreds of thoughtful decisions that collectively project a feeling of quality.
- Coherent Design Language: Every element should visually communicate its function and feel like part of a unified system. Nothing should feel arbitrary.
- Invisibility of Technology: The best technology disappears. Users should focus on their content and goals, not on understanding your interface.
- Start With Why: Before designing any feature, clearly articulate its purpose and value. This clarity should inform every subsequent decision.

### Typographic Excellence

* **Purposeful Typography**: Typography should be treated as a core design element, not an afterthought. Every typeface choice should serve the app's purpose and personality.
* **Typographic Hierarchy**: Construct clear visual distinction between different levels of information. Headlines, subheadings, body text, and captions should each have a distinct but harmonious appearance that guides users through content.
* **Limited Font Selection**: Choose no more than 2-3 typefaces for the entire application. Consider San Francisco, Helvetica Neue, or similarly clean sans-serif fonts that emphasize legibility.
* **Type Scale Harmony**: Establish a mathematical relationship between text sizes (like the golden ratio or major third). This forms visual rhythm and cohesion across the interface.
* **Breathing Room**: Allow generous spacing around text elements. Line height should typically be 1.5x font size for body text, with paragraph spacing that forms clear visual separation without disconnection.

### Color Theory Application

* **Intentional Color**: Every color should have a specific purpose. Avoid decorative colors that don't communicate function or hierarchy.
* **Color as Communication**: Use color to convey meaning - success, warning, information, or action. Maintain consistency in these relationships throughout the app.
* **Sophisticated Palettes**: Prefer subtle, slightly desaturated colors rather than bold primary colors. Consider colors that feel "photographed" rather than "rendered."
* **Contextual Adaptation**: Colors should respond to their environment. Consider how colors appear how they interact with surrounding elements.
* **Focus Through Restraint**: Limit accent colors to guide attention to the most important actions. The majority of the interface should use neutral tones that recede and let content shine.

### Spatial Awareness

* **Compositional Balance**: Every screen should feel balanced, with careful attention to visual weight and negative space. Elements should feel purposefully placed rather than arbitrarily positioned.
* **Grid Discipline**: Maintain a consistent underlying grid system that forms a sense of order while allowing for meaningful exceptions when appropriate.
* **Breathing Room**: Use generous negative space to focus attention and design a sense of calm. Avoid cluttered interfaces where elements compete for attention.
* **Spatial Relationships**: Related elements should be visually grouped through proximity, alignment, and shared attributes. The space between elements should communicate their relationship.


## Human Interface Elements

This section provides comprehensive guidance for creating interactive elements that feel intuitive, responsive, and delightful.

### Core Interaction Principles

* **Direct Manipulation**: Design interfaces where users interact directly with their content rather than through abstract controls. Elements should respond in ways that feel physically intuitive.
* **Immediate Feedback**: Every interaction must provide instantaneous visual feedback (within 100ms), even if the complete action takes longer to process.
* **Perceived Continuity**: Maintain context during transitions. Users should always understand where they came from and where they're going.
* **Consistent Behavior**: Elements that look similar should behave similarly. Build trust through predictable patterns.
* **Forgiveness**: Make errors difficult, but recovery easy. Provide clear paths to undo actions and recover from mistakes.
* **Discoverability**: Core functions should be immediately visible. Advanced functions can be progressively revealed as needed.

### Control Design Guidelines

#### Buttons

* **Purpose-Driven Design**: Visually express the importance and function of each button through its appearance. Primary actions should be visually distinct from secondary or tertiary actions.
* **States**: Every button must have distinct, carefully designed states for:
  - Default (rest)
  - Hover
  - Active/Pressed
  - Focused
  - Disabled

* **Visual Affordance**: Buttons should appear "pressable" through subtle shadows, highlights, or dimensionality cues that respond to interaction.
* **Size and Touch Targets**: Minimum touch target size of 44×44px for all interactive elements, regardless of visual size.
* **Label Clarity**: Use concise, action-oriented verbs that clearly communicate what happens when pressed.

#### Input Controls

* **Form Fields**: Design fields that guide users through correct input with:
  - Clear labeling that remains visible during input
  - Smart defaults when possible
  - Format examples for complex inputs
  - Inline validation with constructive error messages
  - Visual confirmation of successful input

* **Selection Controls**: Toggles, checkboxes, and radio buttons should:
  - Have a clear visual difference between selected and unselected states
  - Provide generous hit areas beyond the visible control
  - Group related options visually
  - Animate state changes to reinforce selection

* **Field Focus**: Highlight the active input with a subtle but distinct focus state. Consider using a combination of color change, subtle animation, and lighting effects.

#### Menus and Lists

* **Hierarchical Organization**: Structure content in a way that communicates relationships clearly.
* **Progressive Disclosure**: Reveal details as needed rather than overwhelming users with options.
* **Selection Feedback**: Provide immediate, satisfying feedback when items are selected.
* **Empty States**: Design thoughtful empty states that guide users toward appropriate actions.

### Motion and Animation

* **Purposeful Animation**: Every animation must serve a functional purpose:
  - Orient users during navigation changes
  - Establish relationships between elements
  - Provide feedback for interactions
  - Guide attention to important changes

* **Natural Physics**: Movement should follow real-world physics with appropriate:
  - Acceleration and deceleration
  - Mass and momentum characteristics
  - Elasticity appropriate to the context

* **Subtle Restraint**: Animations should be felt rather than seen. Avoid animations that:
  - Delay user actions unnecessarily
  - Call attention to themselves
  - Feel mechanical or artificial

* **Timing Guidelines**:
  - Quick actions (button press): 100-150ms
  - State changes: 200-300ms
  - Page transitions: 300-500ms
  - Attention-directing: 200-400ms

* **Spatial Consistency**: Maintain a coherent spatial model. Elements that appear to come from off-screen should return in that direction.

### Responsive States and Feedback

* **State Transitions**: Design smooth transitions between all interface states. Nothing should change abruptly without appropriate visual feedback.
* **Loading States**: Replace generic spinners with purpose-built, branded loading indicators that communicate progress clearly.
* **Success Confirmation**: Acknowledge completed actions with subtle but clear visual confirmation.
* **Error Handling**: Present errors with constructive guidance rather than technical details. Errors should never feel like dead ends.