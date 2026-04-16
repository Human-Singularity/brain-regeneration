# Brain Regeneration Observatory

The Brain Regeneration Observatory is an expansion of the successful [Gregory-MS](https://Gregory-MS.com) platform, designed to accelerate research into brain regeneration and myelin repair. This Hugo-based frontend integrates with GregoryAi to create a comprehensive knowledge hub that tracks therapeutic approaches for reversing damage caused by multiple sclerosis (MS), Alzheimer's Disease, Parkinson's, and other neuro-degenerative diseases.

## Project Mission

Building on Gregory-MS's proven track record of harvesting and de-duplicating scientific literature since 2019, the Brain Regeneration Observatory aims to:

- **Surface high-impact research** within 24 hours of publication
- **Map therapeutic avenues** including remyelination, neuroinflammation control, and stem-cell approaches
- **Monitor clinical trials** across all regenerative medicine approaches
- **Provide patient-centric views** highlighting practical impact and treatment options
- **Support research networks** with customized feeds for investigators and institutions

The platform uses AI models to rank research relevance and delivers tailored alerts to researchers and patients, maintaining our commitment to open science and donor-funded operations. With over 34,000 articles already indexed and partnerships with leading MS organizations, this expansion represents the next phase in democratizing access to cutting-edge neurological research.

## Quick Start

### Prerequisites

- Git
- Docker and Docker Compose
- Hugo (for frontend development)

### Initial Setup

1. Clone this repository:
```bash
git clone <repository-url>
cd brain-regeneration
```

2. Initialize the project and GregoryAi submodule:
```bash
make init
```

3. Set up environment variables for GregoryAi:
```bash
cd gregory-ai
cp example.env .env
# Edit .env with your configuration
```

4. Start GregoryAi services:
```bash
make start-gregory
```

5. Start Hugo development server:
```bash
make hugo-dev
```

Or start both services at once:
```bash
make dev
```

## Available Commands

Run `make help` to see all available commands:

- `make init` - Initialize and setup the project (run this first)
- `make update-gregory` - Update GregoryAi submodule from upstream
- `make start-gregory` - Start GregoryAi using docker-compose
- `make stop-gregory` - Stop GregoryAi services
- `make logs-gregory` - Show GregoryAi logs
- `make status-gregory` - Show status of GregoryAi services
- `make restart-gregory` - Restart GregoryAi services
- `make clean-gregory` - Stop and remove GregoryAi containers and volumes
- `make hugo-dev` - Start Hugo development server
- `make hugo-build` - Build the Hugo site
- `make dev` - Start both GregoryAi and Hugo development server
- `make status` - Show overall project status

## Project Structure

- `/layouts` - Hugo templates and layouts
- `/content` - Site content and pages
- `/assets` - CSS, JS, and other assets
- `/static` - Static files
- `/gregory-ai` - GregoryAi submodule (API backend)
- `/communication` - Project documentation and briefs

## GregoryAi Integration

GregoryAi is included as a git submodule and provides the backend API for:
- Fetching scientific articles
- Organizing clinical trials data
- Processing and filtering research content

The GregoryAi services include:
- PostgreSQL database (port 5432)
- Django API server (port 8000)

## Development Workflow

1. **Update GregoryAi**: `make update-gregory`
2. **Start services**: `make start-gregory`
3. **Develop frontend**: `make hugo-dev`
4. **Check logs**: `make logs-gregory`
5. **Check status**: `make status`

## Environment Configuration

GregoryAi requires environment variables to be set in `gregory-ai/.env`. Copy from `gregory-ai/example.env` and configure:

- Database settings (POSTGRES_*)
- Email configuration (EMAIL_*)
- API keys (ORCID_*, etc.)
- Security keys (SECRET_KEY, FERNET_SECRET_KEY)

## Troubleshooting

- **Submodule issues**: Run `make init` to reinitialize
- **Docker issues**: Run `make clean-gregory` then `make start-gregory`
- **Port conflicts**: Check if ports 5432 or 8000 are already in use
- **Logs**: Use `make logs-gregory` to see detailed error messages

## Contributing

Please refer to the project guidelines in the `communication/` folder for branding, messaging, and development standards.

