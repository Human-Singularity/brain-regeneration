+++
title = "Bootstrap 5 Components"
date = 2025-12-16
description = "Showcase of Bootstrap 5 components working with the Now UI Pro theme"
+++

# Bootstrap 5 Components Showcase

This page demonstrates the core Bootstrap 5 components integrated with the Now UI Pro theme.

---

## Buttons

### Button Styles

<div class="btn-group" role="group">
  <button type="button" class="btn btn-primary">Primary</button>
  <button type="button" class="btn btn-secondary">Secondary</button>
  <button type="button" class="btn btn-success">Success</button>
  <button type="button" class="btn btn-danger">Danger</button>
  <button type="button" class="btn btn-warning">Warning</button>
  <button type="button" class="btn btn-info">Info</button>
</div>

### Button Sizes

<div class="my-3">
  <button type="button" class="btn btn-primary btn-lg">Large Button</button>
  <button type="button" class="btn btn-primary">Default Button</button>
  <button type="button" class="btn btn-primary btn-sm">Small Button</button>
</div>

### Outline Buttons

<div class="my-3">
  <button type="button" class="btn btn-outline-primary">Primary</button>
  <button type="button" class="btn btn-outline-success">Success</button>
  <button type="button" class="btn btn-outline-danger">Danger</button>
</div>

---

## Alerts

<div class="alert alert-primary" role="alert">
  <strong>Primary Alert!</strong> This is a primary alert with an example link. <a href="#" class="alert-link">Click here</a>.
</div>

<div class="alert alert-success" role="alert">
  <strong>Success!</strong> Your operation completed successfully.
</div>

<div class="alert alert-warning" role="alert">
  <strong>Warning!</strong> Please review your input before continuing.
</div>

<div class="alert alert-danger" role="alert">
  <strong>Error!</strong> Something went wrong. Please try again.
</div>

<div class="alert alert-info" role="alert">
  <strong>Info:</strong> Here's some helpful information for you.
</div>

---

## Badges

<h3>Badges <span class="badge bg-primary">New</span></h3>

<p>
  <span class="badge bg-primary">Primary</span>
  <span class="badge bg-secondary">Secondary</span>
  <span class="badge bg-success">Success</span>
  <span class="badge bg-danger">Danger</span>
  <span class="badge bg-warning">Warning</span>
  <span class="badge bg-info">Info</span>
</p>

### Pill Badges

<p>
  <span class="badge rounded-pill bg-primary">Primary</span>
  <span class="badge rounded-pill bg-secondary">Secondary</span>
  <span class="badge rounded-pill bg-success">Success</span>
</p>

---

## Cards

<div class="row">
  <div class="col-md-4">
    <div class="card">
      <img src="https://picsum.photos/400/200" class="card-img-top" alt="Card image">
      <div class="card-body">
        <h5 class="card-title">Card Title</h5>
        <p class="card-text">Some quick example text to build on the card title and make up the bulk of the card's content.</p>
        <a href="#" class="btn btn-primary">Go somewhere</a>
      </div>
    </div>
  </div>
  <div class="col-md-4">
    <div class="card">
      <div class="card-body">
        <h5 class="card-title">Special Title</h5>
        <p class="card-text">With supporting text below as a natural lead-in to additional content.</p>
        <a href="#" class="btn btn-info">Learn More</a>
      </div>
    </div>
  </div>
  <div class="col-md-4">
    <div class="card text-white bg-primary">
      <div class="card-body">
        <h5 class="card-title">Primary Card</h5>
        <p class="card-text">This is a card with primary background color and white text.</p>
      </div>
    </div>
  </div>
</div>

---

## Form Controls

### Input Groups (Bootstrap 5 Structure)

<div class="row">
  <div class="col-md-6">
    <div class="input-group mb-3">
      <span class="input-group-text"><i class="now-ui-icons users_circle-08"></i></span>
      <input type="text" class="form-control" placeholder="Username">
    </div>
  </div>
  <div class="col-md-6">
    <div class="input-group mb-3">
      <span class="input-group-text"><i class="now-ui-icons ui-1_email-85"></i></span>
      <input type="email" class="form-control" placeholder="Email">
    </div>
  </div>
</div>

### Form Example

<form>
  <div class="mb-3">
    <label for="exampleInputEmail1" class="form-label">Email address</label>
    <input type="email" class="form-control" id="exampleInputEmail1" placeholder="name@example.com">
    <div class="form-text">We'll never share your email with anyone else.</div>
  </div>
  <div class="mb-3">
    <label for="exampleInputPassword1" class="form-label">Password</label>
    <input type="password" class="form-control" id="exampleInputPassword1">
  </div>
  <div class="mb-3 form-check">
    <input type="checkbox" class="form-check-input" id="exampleCheck1">
    <label class="form-check-label" for="exampleCheck1">
      Remember me
    </label>
  </div>
  <button type="submit" class="btn btn-primary">Submit</button>
</form>

---

## Progress Bars

<div class="progress mb-3">
  <div class="progress-bar" role="progressbar" style="width: 25%">25%</div>
</div>

<div class="progress mb-3">
  <div class="progress-bar bg-success" role="progressbar" style="width: 50%">50%</div>
</div>

<div class="progress mb-3">
  <div class="progress-bar bg-info" role="progressbar" style="width: 75%">75%</div>
</div>

<div class="progress mb-3">
  <div class="progress-bar bg-warning" role="progressbar" style="width: 100%">Complete!</div>
</div>

---

## Collapse / Accordion

<div class="accordion" id="accordionExample">
  <div class="accordion-item">
    <h2 class="accordion-header" id="headingOne">
      <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#collapseOne" aria-expanded="true" aria-controls="collapseOne">
        Accordion Item #1
      </button>
    </h2>
    <div id="collapseOne" class="accordion-collapse collapse show" aria-labelledby="headingOne" data-bs-parent="#accordionExample">
      <div class="accordion-body">
        <strong>This is the first item's accordion body.</strong> It is shown by default with Bootstrap 5's new accordion structure.
      </div>
    </div>
  </div>
  <div class="accordion-item">
    <h2 class="accordion-header" id="headingTwo">
      <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseTwo" aria-expanded="false" aria-controls="collapseTwo">
        Accordion Item #2
      </button>
    </h2>
    <div id="collapseTwo" class="accordion-collapse collapse" aria-labelledby="headingTwo" data-bs-parent="#accordionExample">
      <div class="accordion-body">
        <strong>This is the second item's accordion body.</strong> It is hidden by default until the collapse plugin adds the appropriate classes.
      </div>
    </div>
  </div>
  <div class="accordion-item">
    <h2 class="accordion-header" id="headingThree">
      <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseThree" aria-expanded="false" aria-controls="collapseThree">
        Accordion Item #3
      </button>
    </h2>
    <div id="collapseThree" class="accordion-collapse collapse" aria-labelledby="headingThree" data-bs-parent="#accordionExample">
      <div class="accordion-body">
        <strong>This is the third item's accordion body.</strong> This component uses Bootstrap 5's native JavaScript for accordion functionality.
      </div>
    </div>
  </div>
</div>

---

## Breadcrumb

<nav aria-label="breadcrumb">
  <ol class="breadcrumb">
    <li class="breadcrumb-item"><a href="/">Home</a></li>
    <li class="breadcrumb-item"><a href="/post/">Blog</a></li>
    <li class="breadcrumb-item active" aria-current="page">Components</li>
  </ol>
</nav>

---

## Pagination

<nav aria-label="Page navigation">
  <ul class="pagination">
    <li class="page-item disabled">
      <a class="page-link" href="#" tabindex="-1">Previous</a>
    </li>
    <li class="page-item"><a class="page-link" href="#">1</a></li>
    <li class="page-item active"><a class="page-link" href="#">2</a></li>
    <li class="page-item"><a class="page-link" href="#">3</a></li>
    <li class="page-item">
      <a class="page-link" href="#">Next</a>
    </li>
  </ul>
</nav>

---

## Tooltips & Popovers

<p>
  <button type="button" class="btn btn-secondary" data-bs-toggle="tooltip" data-bs-placement="top" title="Tooltip on top">
    Tooltip on top
  </button>
  <button type="button" class="btn btn-secondary" data-bs-toggle="tooltip" data-bs-placement="right" title="Tooltip on right">
    Tooltip on right
  </button>
  <button type="button" class="btn btn-secondary" data-bs-toggle="tooltip" data-bs-placement="bottom" title="Tooltip on bottom">
    Tooltip on bottom
  </button>
  <button type="button" class="btn btn-secondary" data-bs-toggle="tooltip" data-bs-placement="left" title="Tooltip on left">
    Tooltip on left
  </button>
</p>

<script>
// Initialize tooltips
document.addEventListener('DOMContentLoaded', function() {
  var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
});
</script>

---

## Grid System

<div class="row">
  <div class="col-md-4">
    <div class="p-3 border bg-light">Column 1</div>
  </div>
  <div class="col-md-4">
    <div class="p-3 border bg-light">Column 2</div>
  </div>
  <div class="col-md-4">
    <div class="p-3 border bg-light">Column 3</div>
  </div>
</div>

<div class="row mt-3">
  <div class="col-md-6">
    <div class="p-3 border bg-light">Column 1 (50%)</div>
  </div>
  <div class="col-md-6">
    <div class="p-3 border bg-light">Column 2 (50%)</div>
  </div>
</div>

---

## Bootstrap 5 Migration Notes

This page demonstrates that all Bootstrap 5 components work correctly with the Now UI Pro theme:

- ✅ Input groups use direct children (no wrapper divs needed)
- ✅ Badges use `.bg-*` classes instead of `.badge-*`
- ✅ Accordion uses new Bootstrap 5 structure
- ✅ All utility classes updated (.float-start/.float-end)
- ✅ Screen reader classes use `.visually-hidden`
- ✅ Data attributes use `data-bs-*` prefix
