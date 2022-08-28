export default {
  test: {
    query: `export const handler = async props => {
            return {
                result: [
                    {
                        id: 1,
                        description: "container manifest",
                        items: [
                            { id: 1, description: "item 1" },
                            { id: 2, description: "item 2" },
                        ]
                    },
                    {
                        id: 2,
                        description: "container manifest",
                        items: [
                            { id: 1, description: "item a" },
                            { id: 2, description: "item b" },
                        ]
                    }
                ]
            }
        }`,
    log: `export const handler = async props => {
            log(props.message);
            return {
                result: props.message
            }
        }`,
    auth: `export const handler = async props => {
            let authorized = props.auth.test === "token" ? true : false;
            log(authorized)
            return {
                result: authorized
            }
        }`
  }
}
