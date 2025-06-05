import { request, log } from "@zhx-cli/utils";

// 通过API获取项目模版
export default async function getTemplateFormAPI() {
  try {
    const data = await request({
      url: '/v1/project',
      method: 'get'
    });
    log.verbose('template', data);
    return data;
  } catch (e) {
    console.log(e);
    return null;
  }
}