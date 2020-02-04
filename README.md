eScriptorium is part of the [scripta](https://www.psl.eu/en/scripta) project, its goal is provide researchers in the humanity field with an integrated set of tools to transcribe, annotate, translate and publish historical documents.  
The eScriptorium app itself is at the 'center'. It is a work in progress but will implement at least automatic transcriptions through kraken, indexation for complex search and filtering, annotation and some simple form of collaborative working (sharing, versioning)
  
## The stack
- nginx
- uwsgi
- [django](https://www.djangoproject.com/)
- [daphne](https://github.com/django/daphne) (channel server for websockets)
- [celery](http://www.celeryproject.org/)
- postgres
- [elasticsearch](https://www.elastic.co/) (integration not started yet)
- redis (cache, celery broker, other disposable data)
- [kraken](http://kraken.re)
- [docker](https://www.docker.com/) (deployment)
  
  
## Install
Two options, [install with Docker](install-with-docker), or a [full local install](full-install).  


## Contributing
Cf [Contributing to eScriptorium](contributing).