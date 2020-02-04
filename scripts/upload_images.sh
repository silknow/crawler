#!/usr/bin/env bash

SCRIPTPATH="$( cd "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
source "${SCRIPTPATH}/config.sh"
source "${SCRIPTPATH}/lib.sh"

# Report usage
usage() {
  echo "Usage:"
  echo "$(basename $0) [options] [--] [file path]"

  # Optionally exit with a status code
  if [ -n "$1" ]; then
    exit "$1"
  fi
}

invalid() {
  echo "ERROR: Unrecognized argument: $1" >&2
  usage 1
}

# Pre-process options to:
# - expand -xyz into -x -y -z
# - expand --longopt=arg into --longopt arg
ARGV=()
END_OF_OPT=
while [[ $# -gt 0 ]]; do
  arg="$1"; shift
  case "${END_OF_OPT}${arg}" in
    --) ARGV+=("$arg"); END_OF_OPT=1 ;;
    --*=*)ARGV+=("${arg%%=*}" "${arg#*=}") ;;
    --*) ARGV+=("$arg"); END_OF_OPT=1 ;;
    -*) for i in $(seq 2 ${#arg}); do ARGV+=("-${arg:i-1:1}"); done ;;
    *) ARGV+=("$arg") ;;
  esac
done

# Apply pre-processed options
set -- "${ARGV[@]}"

# Parse options
END_OF_OPT=
POSITIONAL=()
while [[ $# -gt 0 ]]; do
  case "${END_OF_OPT}${1}" in
    -h|--help)      usage 0 ;;
    -q|--quiet)     QUIET=1 ;;
    --)             END_OF_OPT=1 ;;
    -*)             invalid "$1" ;;
    *)              POSITIONAL+=("$1") ;;
  esac
  shift
done

# Restore positional parameters
set -- "${POSITIONAL[@]}"

filepath="${1}"
museumName="${2}"
upload_to_owncloud=false
upload_to_mediaserver=false

if [[ ! "${filepath}" ]]; then
  echo "Please enter a file path"
  exit 1
fi

if [[ ! "${museumName}" ]]; then
  echo "Please enter a museum name (eg. mfa-boston, ceres-mcu, vam, ...)"
  exit 1
fi

if [ -z ${QUIET+x} ]; then
  read -p "Upload to ownCloud? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]
  then
    upload_to_owncloud=true
  fi
else
  upload_to_owncloud=true # true by default if QUIET is set
fi

if [ -z ${QUIET+x} ]; then
  read -p "Upload to media server? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]
  then
    upload_to_mediaserver=true
  fi
else
  upload_to_mediaserver=true # true by default if QUIET is set
fi

if [ "$upload_to_owncloud" = true ] ; then
  oc_upload "${filepath}"
fi

if [ "$upload_to_mediaserver" = true ] ; then
  media_upload "${filepath}" "${museumName}"
fi
