import inquirer from 'inquirer';

function make ({
  choices,
  defaultValue,
  message,
  type = 'list',
  require = true,
  mask = '*',
  validate,
  pageSize,
  loop
}) {
  const options = {
    name: 'name',
    default: defaultValue,
    message,
    type,
    require,
    mask,
    validate,
    pageSize,
    loop
  };

  if (type === 'list') {
    options.choices = choices
  }

  return inquirer.prompt(options).then(answer => answer.name);
}

export function makeList(params) {
  return make({ ...params });
}

export function makeInput(params) {
  return make({
    type: 'input',
    ...params
  })
}

export function makePassword(params) {
  return make({
    type: 'password',
    ...params
  })
}

export function makeConfirm(params) {
  return make({
    type: 'confirm',
    ...params
  })
}
