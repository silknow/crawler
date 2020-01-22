#!/usr/bin/env bash

source "${BASH_SOURCE%/*}/config.sh"

is_tar_valid() {
  tar -tzf "${1}" >/dev/null
  return $?
}

# wait
# $1 = seconds to wait
dotsleep() {
  for ((i=1;i<=$1;i++)); do
    echo -n "."
    sleep 1
  done
  echo
}

# upload to ownCloud server
# $1 = file path
oc_upload() {
  local srcpath
  local filename
  local destpath

  srcpath="${1}"

  # Check for file validity
  if [[ ! -f "${srcpath}" ]]; then
    echo "${FUNCNAME[0]}: ${srcpath}: No such file"
    return 1
  fi
  echo "${FUNCNAME[0]}: Verifying archive..."
  if ! is_tar_valid "${srcpath}"; then
    echo "${FUNCNAME[0]}: ${srcpath}: Archive could not be verified"
    return 1
  fi
  filename="$(basename -- "${srcpath}")"
  destpath="Data/${filename}"

  # Check for config variables
  if [[ -z "${oc_user}" ]]; then
    echo "${FUNCNAME[0]}: ${srcpath}: oc_user is undefined in config.sh"
    return 1
  fi
  if [[ -z "${oc_pass}" ]]; then
    echo "${FUNCNAME[0]}: ${srcpath}: oc_pass is undefined in config.sh"
    return 1
  fi

  echo "${FUNCNAME[0]}: Uploading ${srcpath} to ownCloud (${destpath})"
  curl -X PUT -u "${oc_user}:${oc_pass}" --cookie "XDEBUG_SESSION=MROW4A;path=/;" --data-binary @"${srcpath}" "https://silknow.uv.es/owncloud/remote.php/webdav/${destpath}"
}

# upload to media server
# $1 = file path
# $2 = museum name (identifier)
media_upload() {
  local srcpath
  local museumName
  local filename
  local destpath
  local cmd
  local confirm

  srcpath="${1}"
  museumName="${2}"

  if [[ ! "${museumName}" ]]; then
    echo "${FUNCNAME[0]}: Invalid museum name"
    return 1
  fi

  # Check for file validity
  if [[ ! -f "${srcpath}" ]]; then
    echo "${FUNCNAME[0]}: ${srcpath}: No such file"
    return 1
  fi
  filename="$(basename -- "${srcpath}")"
  echo "${FUNCNAME[0]}: Verifying archive..."
  if ! is_tar_valid "${srcpath}"; then
    echo "${FUNCNAME[0]}: ${srcpath}: Archive could not be verified"
    return 1
  fi

  # Check for config variables
  if [[ -z "${media_user}" ]]; then
    echo "${FUNCNAME[0]}: media_user is undefined in config.sh"
    return 1
  fi
  if [[ -z "${media_folder}" ]]; then
    echo "${FUNCNAME[0]}: media_folder is undefined in config.sh"
    return 1
  fi

  destpath="${media_folder}/${filename}"
  cmd="shopt -s dotglob; cd '${media_folder}'; rm '${media_folder}/${museumName}/'*; tar -zxf '${filename}'; mv '${museumName}/files/'* '${media_folder}/${museumName}/'; rmdir '${media_folder}/${museumName}/files'; rm '${media_folder}/${filename}';"
  echo "${FUNCNAME[0]}: About to upload to media server (${destpath})"
  echo "${FUNCNAME[0]}: About to execute the following commands: $cmd"

  echo "${FUNCNAME[0]}: Uploading ${srcpath} to media server (${destpath})"
  scp "${srcpath}" "${media_user}"@silknow.uv.es:"${destpath}"
  echo "${FUNCNAME[0]}: Extracting ${destpath}"
  ssh "${media_user}"@silknow.uv.es "${cmd}"
}
